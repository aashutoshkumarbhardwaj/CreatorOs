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

    const user = req.user;
    
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: [
                {
                    price: priceId || process.env.STRIPE_PRO_PRICE_ID,
                    quantity: 1,
                },
            ],
            mode: "subscription",
            success_url: `${process.env.BASE_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL}/dashboard?checkout=cancelled`,
            customer_email: user.email,
            client_reference_id: user._id.toString(),
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

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const userId = session.client_reference_id;
        
        if (userId) {
            await User.findByIdAndUpdate(userId, { tier: "pro", stripeCustomerId: session.customer });
            console.log(`User ${userId} upgraded to Pro tier via webhook`);
        }
    }

    res.json({ received: true });
});

module.exports = {
    createCheckoutSession,
    handleWebhook
};
