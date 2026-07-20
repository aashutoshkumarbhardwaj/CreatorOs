const asyncHandler = require("../utils/asyncHandler");
const User = require("../model/user");

// Initialize Stripe (use mock if key is missing)
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
    const Stripe = require("stripe");
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
}

// POST /api/billing/checkout
const createCheckoutSession = asyncHandler(async (req, res) => {
    const { priceId } = req.body || {};
    if (!process.env.STRIPE_SECRET_KEY) {
        // Mock success for development
        return res.json({ success: true, url: "/dashboard?mockStripeCheckout=success" });
    }

    const resolvedPriceId = priceId || process.env.STRIPE_PRO_PRICE_ID;
    if (!resolvedPriceId || !process.env.BASE_URL) {
        console.error("Stripe checkout misconfigured: missing STRIPE_PRO_PRICE_ID or BASE_URL");
        return res.status(500).json({ success: false, message: "Billing is not configured correctly" });
    }

    const user = req.user;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price: resolvedPriceId,
                    quantity: 1,
                },
            ],
            mode: "subscription",
            success_url: `${process.env.BASE_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL}/dashboard?checkout=cancelled`,
            customer_email: user.email,
            client_reference_id: user.id,
        });

        res.json({ success: true, url: session.url });
    } catch (error) {
        console.error("Stripe error:", error);
        res.status(500).json({ success: false, message: "Failed to create checkout session" });
    }
});

// POST /api/billing/webhook
const handleWebhook = asyncHandler(async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event = req.body;

    if (process.env.STRIPE_WEBHOOK_SECRET) {
        try {
            event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            console.error("Webhook Error:", err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }
    }

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object;
            const userId = session.client_reference_id;

            if (userId) {
                const subscription = session.subscription
                    ? await stripe.subscriptions.retrieve(session.subscription)
                    : null;

                await User.findByIdAndUpdate(userId, {
                    "subscription.status": "active",
                    "subscription.stripeCustomerId": session.customer,
                    "subscription.stripeSubscriptionId": session.subscription,
                    "subscription.priceId": subscription?.items?.data?.[0]?.price?.id,
                    "subscription.currentPeriodEnd": subscription?.current_period_end
                        ? new Date(subscription.current_period_end * 1000)
                        : undefined,
                    "subscription.cancelAtPeriodEnd": subscription?.cancel_at_period_end ?? false,
                });
                console.log(`User ${userId} subscription activated via webhook`);
            }
            break;
        }

        case "customer.subscription.updated": {
            const subscription = event.data.object;
            const user = await User.findOne({ "subscription.stripeCustomerId": subscription.customer });

            if (user) {
                await User.findByIdAndUpdate(user._id, {
                    "subscription.status": subscription.status === "active" ? "active" : subscription.status,
                    "subscription.priceId": subscription.items?.data?.[0]?.price?.id,
                    "subscription.currentPeriodEnd": new Date(subscription.current_period_end * 1000),
                    "subscription.cancelAtPeriodEnd": subscription.cancel_at_period_end,
                });
            }
            break;
        }

        case "customer.subscription.deleted": {
            const subscription = event.data.object;
            const user = await User.findOne({ "subscription.stripeCustomerId": subscription.customer });

            if (user) {
                await User.findByIdAndUpdate(user._id, {
                    "subscription.status": "canceled",
                    "subscription.cancelAtPeriodEnd": false,
                });
            }
            break;
        }

        default:
            break;
    }

    res.json({ received: true });
});

module.exports = {
    createCheckoutSession,
    handleWebhook
};
