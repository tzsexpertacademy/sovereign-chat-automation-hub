-- Add Stripe integration fields to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS billing_address JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS annual_plan BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS mrr NUMERIC(10,2) DEFAULT 0.00;

-- Create index for efficient Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_clients_stripe_customer_id ON public.clients(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_clients_subscription_status ON public.clients(subscription_status);

-- Update clients table with better constraints
ALTER TABLE public.clients 
ADD CONSTRAINT check_subscription_status 
CHECK (subscription_status IN ('active', 'inactive', 'trialing', 'past_due', 'canceled', 'unpaid'));

-- Add comments for documentation
COMMENT ON COLUMN public.clients.stripe_customer_id IS 'Stripe customer ID for billing integration';
COMMENT ON COLUMN public.clients.subscription_status IS 'Current subscription status from Stripe';
COMMENT ON COLUMN public.clients.mrr IS 'Monthly Recurring Revenue in USD';