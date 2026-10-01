-- One-time free-trial guard.
--
-- Previously plan-checkout attached `trial_period_days` to EVERY subscription
-- checkout, so a user could trial → cancel → wait out the period → resubscribe
-- and collect an unlimited chain of free trials. This flag records that a
-- profile has already consumed its trial; the checkout route only grants a
-- trial when it is still false, and the stripe-webhook flips it to true the
-- moment a subscription is first observed in `trialing` status.
alter table public.profiles
  add column if not exists has_used_trial boolean not null default false;

-- Backfill: anyone who already reached Stripe (has a customer id) has had their
-- shot at the trial. Mark them used so the fix can't be dodged by resubscribing.
update public.profiles
  set has_used_trial = true
  where stripe_customer_id is not null
    and has_used_trial = false;
