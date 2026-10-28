// Hotels as published on travel.belo.app, read from its search pages in a browser.
// belo exposes no API for Travel inventory, so this is a dated snapshot: prices are
// the ones shown on checkedAt for checkedDates, never a live quote.
// ponytail: hand-kept catalog; replace with a real Travel API the day belo publishes one.

export type BeloTravelHotel = {
  id: string;
  name: string;
  address: string;
  stars: number | null;
  ratingLabel: string;
  rating: number;
  listPrice: number;
  price: number;
  discount: number;
  image: string | null;
};
type Destination = {
  name: string;
  match: RegExp;
  q: string;
  placeId: string | null;
  sorting: string;
  checkedAt: string;
  checkedDates: [string, string];
  hotels: BeloTravelHotel[];
};

const cdn = (id: string, file: string) => `https://cdn.entravel.com/images/properties/${id}/${file}`;

export const beloTravelCatalog: Destination[] = [
  {
    name: "San Miguel de Tucumán, Argentina",
    match: /tucum[aá]n/i,
    q: "San Miguel de Tucumán, Tucumán Province, Argentina",
    placeId: "ChIJA2nF1pI3IpQRJ2XFtZJbjfg",
    sorting: "Discount-desc",
    checkedAt: "2026-10-28",
    checkedDates: ["2026-10-28", "2026-10-29"],
    hotels: [
      { id: "5952347", name: "Sheraton Tucuman Hotel", address: "Av. Soldati y Calle Haití, San Miguel de Tucumán", stars: 4, ratingLabel: "Excelente", rating: 4.5, listPrice: 283246, price: 181277, discount: 36, image: cdn("5952347", "89cdfa9449f2bb8e658ef37456ee40308b2241bc.jpg") },
      { id: "15361755", name: "Ramada Plaza by Wyndham Tucuman", address: "Laprida 35, San Miguel de Tucumán", stars: 4, ratingLabel: "Bueno", rating: 3.3, listPrice: 252442, price: 191856, discount: 24, image: cdn("15361755", "8385deb078ea3b2685271559202f6249a7f3c68b.jpg") },
      { id: "111276535", name: "Hotel del Jardín", address: "Laprida, San Miguel de Tucumán", stars: 4, ratingLabel: "Bueno", rating: 3.4, listPrice: 62323, price: 49859, discount: 20, image: cdn("111276535", "da35126fb903f0978f9ce4c39ce6bf57edee1859.jpg") },
    ],
  },
  {
    name: "Las Vegas, Estados Unidos",
    match: /las vegas/i,
    q: "US Navy Enlisted Recruiting, West Lake Mead Boulevard, Las Vegas, NV, USA",
    placeId: "ChIJCYN1ujrAyIARA1QZVtiGPBk",
    sorting: "DistanceToPoint-asc",
    checkedAt: "2026-10-28",
    checkedDates: ["2026-10-28", "2026-10-29"],
    hotels: [
      { id: "426550", name: "JW Marriott Las Vegas Resort & Spa", address: "221 N Rampart Blvd, Las Vegas", stars: 4, ratingLabel: "Excelente", rating: 4.5, listPrice: 964416, price: 704023, discount: 27, image: cdn("426550", "8dbef4a3b39d0c729a259a88ea3759233d692e3a.jpg") },
      { id: "529239", name: "Suncoast Hotel and Casino", address: "9090 Alta Dr, Las Vegas", stars: 4, ratingLabel: "Excelente", rating: 4.5, listPrice: 902857, price: 505600, discount: 44, image: cdn("529239", "84c9603886fe27bd9ebea6ef11af95ae8626cd09.jpg") },
    ],
  },
  {
    name: "Isla Margarita, Venezuela",
    match: /margarita/i,
    q: "Isla Margarita, Nueva Esparta, Venezuela",
    placeId: null,
    sorting: "DistanceToPoint-asc",
    checkedAt: "2026-10-28",
    checkedDates: ["2026-10-28", "2026-10-29"],
    hotels: [
      { id: "3516005", name: "Lidotel Margarita", address: "Centro Sambil Margarita, Av. Jóvito, Maneiro", stars: null, ratingLabel: "Excelente", rating: 4.5, listPrice: 219225, price: 190726, discount: 13, image: null },
      { id: "107629975", name: "Maloka Hotel Boutique & Spa", address: "Playa Guacuco, Arismendi", stars: null, ratingLabel: "Excelente", rating: 5, listPrice: 369911, price: 318124, discount: 14, image: null },
      { id: "108416529", name: "Cala Margarita Hotel Boutique & Spa", address: "Ranchos de Chana, Paraguachí", stars: null, ratingLabel: "Excelente", rating: 5, listPrice: 516424, price: 413139, discount: 20, image: null },
      { id: "4479570", name: "Ikin Margarita Hotel & Spa", address: "Calle El Melonal, El Cardón, Paraguachí", stars: null, ratingLabel: "Excelente", rating: 4.8, listPrice: 328263, price: 288871, discount: 12, image: null },
      { id: "30216346", name: "H2otel Boutique BY LD Hoteles", address: "Calle Miragua, Playa El Agua, Paraguachí", stars: null, ratingLabel: "Excelente", rating: 4.7, listPrice: 287911, price: 250483, discount: 13, image: null },
      { id: "107863966", name: "Hesperia Playa el Agua Todo Incluido", address: "Av. 31 de Julio, Playa El Agua, Paraguachí", stars: null, ratingLabel: "Bueno", rating: 3.8, listPrice: 199189, price: 171303, discount: 14, image: null },
    ],
  },
];

export function findBeloTravelDestination(text: string) {
  return beloTravelCatalog.find((destination) => destination.match.test(text));
}

const compact = (isoDate: string) => isoDate.replaceAll("-", "");

// Same URL the belo travel search page builds (the one shared as reference).
export function beloTravelSearchUrl(destination: Destination, checkIn: string, checkOut: string, adults: number) {
  const params = new URLSearchParams({ businessTrip: "false", dates: `${compact(checkIn)},${compact(checkOut)}` });
  if (destination.placeId) params.set("placeId", destination.placeId);
  params.set("propertyTypes", "1");
  params.set("q", destination.q);
  params.set("rooms", `${adults}-`);
  params.set("sorting", destination.sorting);
  params.set("stars", "4,5");
  params.set("currency", "ARS");
  return `https://travel.belo.app/search?${params.toString().replaceAll("+", "%20").replaceAll("%2C", ",")}`;
}

export function beloTravelHotelUrl(id: string, checkIn: string, checkOut: string, adults: number) {
  return `https://travel.belo.app/hotel/${id}?currency=ARS&s_room=${adults}-&s_dates=${compact(checkIn)}%2C${compact(checkOut)}`;
}
