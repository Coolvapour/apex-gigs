import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { phone, amount, userId, planId } = await req.json()

    // Sandbox Credentials
    const consumerKey = "avPPYDjgd0rdQ2jAzGKDADa0kurvtKnzvUJ3xlYq52Y3hp1V"
    const consumerSecret = "GAWUrJf3AylzxDThmaQx6rmQyGugGZn3T9kogHSGaUs025RHtwA0Z79fHYBZKUHn"
    const shortCode = "174379"
    const passkey = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"

    // 1. Get Token
    const auth = btoa(`${consumerKey}:${consumerSecret}`)
    const tokenRes = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      headers: { Authorization: `Basic ${auth}` }
    })
    const { access_token } = await tokenRes.json()

    // 2. Prepare STK Push
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
    const password = btoa(shortCode + passkey + timestamp)

    let formattedPhone = phone.replace(/\D/g, '')
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1)

    // CRITICAL: Link the payment to the user using query parameters
    const callbackUrl = `https://zpmpbnjyapszxeprcnva.supabase.co/functions/v1/mpesa-callback?userId=${userId}&planId=${planId}`;

    const response = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: "ApexGigs",
        TransactionDesc: `Subscription ${planId}`
      })
    })

    const result = await response.json()
    return new Response(JSON.stringify(result), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: corsHeaders 
    })
  }
})