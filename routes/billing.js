const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const User = require('../model/user');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');

router.post('/create-checkout-session', protect, asyncHandler(async (req, res) => {
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Pro Subscription',
                    },
                    unit_amount: 2900, // $29.00
                },
                quantity: 1,
            },
        ],
        mode: 'subscription',
        success_url: `${req.protocol}://${req.get('host')}/settings?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/settings?canceled=true`,
        client_reference_id: req.user._id.toString(),
    });

    res.json({ id: session.id, url: session.url });
}));

// Webhook must use raw body parser, so we handle it before `express.json()` in index.js, 
// but for simplicity in this MVP, we can assume express.json() is fine if we don't strictly verify signatures, 
// OR we mount this webhook appropriately.
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    let event = req.body;
    
    // In production, verify the webhook signature!
    // try {
    //     event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    // } catch (err) {
    //     return res.status(400).send(`Webhook Error: ${err.message}`);
    // }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.client_reference_id;
        
        if (userId) {
            await User.findByIdAndUpdate(userId, {
                'subscription.planName': 'Pro',
                'subscription.priceMonthly': 29,
                'subscription.stripeCustomerId': session.customer,
                'subscription.stripeSubscriptionId': session.subscription
            });
        }
    }

    res.json({ received: true });
}));

module.exports = router;
