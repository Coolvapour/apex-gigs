import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS (Essential for external calls)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const planId = url.searchParams.get('planId');

    // 2. Parse the M-Pesa Data
    const body = await req.json();
    const callbackData = body?.Body?.stkCallback;

    console.log(`Processing M-Pesa for ${userId}, Plan ${planId}. Result: ${callbackData?.ResultCode}`);

    // ResultCode 0 is a SUCCESSFUL transaction
    if (callbackData?.ResultCode === 0 && userId) {
      // Use the secrets you just set in the global Settings
      const serviceKey = Deno.env.get('APP_SERVICE_KEY');
      const supabaseUrl = Deno.env.get('PROJECT_URL');

      if (!serviceKey || !supabaseUrl) {
        throw new Error("Missing Secrets! Add APP_SERVICE_KEY and PROJECT_URL to Global Edge Function Secrets.");
      }

      const supabase = createClient(supabaseUrl, serviceKey);

      // Category logic
      const planCategories = {
        'A1': ['Online writing', 'Academic writing', 'Mercor AI'],
        'A2': ['eBay tasks', 'Data entry', 'Chat moderation'],
        'A3': ['Map reviews', 'Data annotation', 'Handshake AI']
      };

      const { error } = await supabase
        .from('profiles')
        .update({ 
          is_subscribed: true, 
          tier: planId,
          allowed_categories: planCategories[planId] || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
        
      if (error) {
        console.error("Database Update Error:", error.message);
      } else {
        console.log(`User ${userId} successfully upgraded to ${planId}`);
      }
    }

    // 3. IMPORTANT: Tell Safaricom we received the message
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Critical Error:", error.message);
    // Even if it fails, return 200 so M-Pesa stops retrying
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: error.message }), { 
      status: 200, 
      headers: corsHeaders 
    });
  }
})