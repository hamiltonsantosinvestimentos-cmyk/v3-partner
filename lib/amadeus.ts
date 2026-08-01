/**
 * Amadeus for Developers — Self-Service Flight Offers Search
 * OAuth2 client_credentials + busca de menor preço por rota/data.
 * https://developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-search
 */

const IS_PRODUCTION = (process.env.AMADEUS_ENV ?? "test") === "production";

const AMADEUS_HOST = IS_PRODUCTION ? "api.amadeus.com" : "test.api.amadeus.com";
const AMADEUS_BASE = `https://${AMADEUS_HOST}`;

const API_KEY = process.env.AMADEUS_API_KEY;
const API_SECRET = process.env.AMADEUS_API_SECRET;

export function isAmadeusConfigured(): boolean {
  return Boolean(API_KEY && API_SECRET);
}

// Cache de token em memória (Amadeus expira em ~30 min)
let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getAmadeusToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }
  if (!API_KEY || !API_SECRET) {
    throw new Error("AMADEUS_API_KEY / AMADEUS_API_SECRET não configurados");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: API_KEY,
    client_secret: API_SECRET,
  });

  const res = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Amadeus auth error ${res.status}: ${errText}`);
  }

  const parsed = (await res.json()) as { access_token: string; expires_in: number };
  _tokenCache = {
    token: parsed.access_token,
    expiresAt: Date.now() + (parsed.expires_in - 60) * 1000,
  };
  return _tokenCache.token;
}

export type FlightOffer = {
  id: string;
  price: number;
  currency: string;
  airlineCode: string;
  airlineName: string;
  stops: number;
  durationOutbound: string;
  durationReturn: string | null;
  departure: string;
  arrival: string;
  bookableSeats: number | null;
};

type AmadeusSearchParams = {
  originIata: string;
  destinationIata: string;
  departureDate: string; // YYYY-MM-DD
  returnDate?: string | null; // YYYY-MM-DD, omitido = somente ida
  adults?: number;
  currency?: string;
  max?: number;
};

// Busca ofertas de voo e retorna já ordenado por preço (mais barato primeiro)
export async function searchFlights(params: AmadeusSearchParams): Promise<FlightOffer[]> {
  const token = await getAmadeusToken();

  const qs = new URLSearchParams({
    originLocationCode: params.originIata,
    destinationLocationCode: params.destinationIata,
    departureDate: params.departureDate,
    adults: String(params.adults ?? 1),
    currencyCode: params.currency ?? "BRL",
    max: String(params.max ?? 10),
    nonStop: "false",
  });
  if (params.returnDate) qs.set("returnDate", params.returnDate);

  const res = await fetch(`${AMADEUS_BASE}/v2/shopping/flight-offers?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Amadeus flight-offers error ${res.status}: ${errText}`);
  }

  const parsed = (await res.json()) as {
    data?: Array<{
      id: string;
      price: { total: string; currency: string };
      numberOfBookableSeats?: number;
      itineraries: Array<{
        duration: string;
        segments: Array<{ carrierCode: string; numberOfStops?: number }>;
      }>;
    }>;
    dictionaries?: { carriers?: Record<string, string> };
  };

  const carriers = parsed.dictionaries?.carriers ?? {};
  const offers = parsed.data ?? [];

  return offers
    .map((offer): FlightOffer => {
      const outbound = offer.itineraries[0];
      const inbound = offer.itineraries[1] ?? null;
      const firstSegment = outbound?.segments?.[0];
      const carrierCode = firstSegment?.carrierCode ?? "—";
      const stops = (outbound?.segments?.length ?? 1) - 1;

      return {
        id: offer.id,
        price: Number(offer.price.total),
        currency: offer.price.currency,
        airlineCode: carrierCode,
        airlineName: carriers[carrierCode] ?? carrierCode,
        stops,
        durationOutbound: outbound?.duration ?? "",
        durationReturn: inbound?.duration ?? null,
        departure: params.departureDate,
        arrival: params.returnDate ?? params.departureDate,
        bookableSeats: offer.numberOfBookableSeats ?? null,
      };
    })
    .sort((a, b) => a.price - b.price);
}
