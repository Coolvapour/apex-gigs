import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  const planId = url.searchParams.get('planId');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const body = await req.json();
    const callbackData = body.Body.stkCallback;

    if (callbackData.ResultCode === 0) {
      // Payment Successful!
      const planCategories = {
        'A1': ['Online writing', 'Academic writing', 'Mercor AI'],
        'A2': ['eBay tasks', 'Data entry', 'Chat moderation'],
        'A3': ['Map reviews', 'Data annotation', 'Handshake AI']
      };

      await supabase
        .from('profiles')
        .update({ 
          is_subscribed: true, 
          tier: planId,
          allowed_categories: planCategories[planId] || [],
          updated_at: new Date()
        })
        .eq('id', userId);
        
      console.log(`User ${userId} subscribed to ${planId}`);
    }

    return new Response(JSON.stringify({ message: "Success" }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
})