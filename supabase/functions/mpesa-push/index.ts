import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, amount, userId } = await req.json()

    // 1. Get Access Token
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")
    const auth = btoa(`${consumerKey}:${consumerSecret}`)
    
    const tokenResponse = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      headers: { Authorization: `Basic ${auth}` }
    })
    
    const { access_token } = await tokenResponse.json()
    if (!access_token) throw new Error("Failed to get M-Pesa access token")

    // 2. Prepare STK Push Parameters
    const shortCode = Deno.env.get("MPESA_SHORTCODE") || "174379"
    const passkey = Deno.env.get("MPESA_PASSKEY")
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
    const password = btoa(shortCode + passkey + timestamp)

    // Ensure phone is in 2547XXXXXXXX format
    let formattedPhone = phone.replace(/\D/g, '')
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1)

    const stkPayload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: `https://zpmpbnjyapszxeprcnva.supabase.co/functions/v1/mpesa-callback`,
      AccountReference: `ApexGigs`,
      TransactionDesc: `Pay for ${userId.slice(0, 8)}`
    }

    // 3. Request STK Push
    const response = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkPayload)
    })

    const result = await response.json()

    return new Response(JSON.stringify(result), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error) {
    console.error("M-Pesa Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    })
  }
})