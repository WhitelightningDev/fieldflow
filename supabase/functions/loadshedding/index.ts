const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ESP_BASE = "https://developer.sepush.co.za/business/2.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ESKOMSEPUSH_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: "EskomSePush API key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { action, area_id, search, lat, lon } = await req.json();

    let url: string;

    switch (action) {
      case "status":
        url = `${ESP_BASE}/status`;
        break;
      case "area":
        if (!area_id) throw new Error("area_id is required");
        url = `${ESP_BASE}/area?id=${encodeURIComponent(area_id)}`;
        break;
      case "areas_search":
        if (!search) throw new Error("search query is required");
        url = `${ESP_BASE}/areas_search?text=${encodeURIComponent(search)}`;
        break;
      case "areas_nearby":
        if (!lat || !lon) throw new Error("lat and lon are required");
        url = `${ESP_BASE}/areas_nearby?lat=${lat}&lon=${lon}`;
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const response = await fetch(url, {
      headers: { Token: apiKey },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("EskomSePush API error:", data);
      return new Response(
        JSON.stringify({ success: false, error: data?.error || `ESP API returned ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Load shedding function error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
