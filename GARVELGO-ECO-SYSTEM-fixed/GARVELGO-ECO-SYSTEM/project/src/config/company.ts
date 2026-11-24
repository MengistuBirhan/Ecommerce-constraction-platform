/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  LANDING PAGE CONTENT — edit this file only; no other code needs to change.
 *  Everything below is PLACEHOLDER data. Replace phones, email, hours, addresses
 *  and map coordinates with your real company details.
 * ─────────────────────────────────────────────────────────────────────────────
 *  Map coordinates: in Google Maps right-click a spot → click the "lat, lng"
 *  numbers to copy them. Or set `mapQuery` to a place name / address instead.
 */

export interface PhoneLine {
  label: string;
  labelAm: string;
  number: string; // shown as written; the tel: link strips spaces
}

export interface HoursLine {
  days: string;
  daysAm: string;
  time: string;
  timeAm: string;
}

export interface Branch {
  id: string;
  isMain?: boolean;
  name: string;
  nameAm: string;
  address: string;
  addressAm: string;
  /** Short "how to find us" guide. */
  directions: string;
  directionsAm: string;
  phone: string;
  hours: string;
  hoursAm: string;
  lat: number;
  lng: number;
  /** Optional: overrides lat/lng for the map pin (e.g. "Garvelgo Material Supply, Addis Ababa"). */
  mapQuery?: string;
}

export interface Service {
  key: 'materials' | 'delivery' | 'payments' | 'gate';
  title: string;
  titleAm: string;
  desc: string;
  descAm: string;
}

export const COMPANY_INFO = {
  name: 'GARVELGO',
  nameFull: 'Garvelgo Material Supply',
  nameAm: 'ጋርቬልጎ የግንባታ እቃ አቅርቦት',
  tagline: 'Construction Materials Sales & Dispatch',
  taglineAm: 'የግንባታ እቃ ሽያጭ እና መቆጣጠሪያ',

  phones: [
    { label: 'Customer Support', labelAm: 'የደንበኞች አገልግሎት', number: '+251 91 000 0000' },
    { label: 'Sales Desk', labelAm: 'የሽያጭ ክፍል', number: '+251 92 000 0000' },
  ] as PhoneLine[],

  email: 'info@example.com',
  supportEmail: 'support@example.com',

  hours: [
    {
      days: 'Monday – Saturday',
      daysAm: 'ሰኞ – ቅዳሜ',
      time: '8:00 AM – 6:00 PM',
      timeAm: 'ከጠዋቱ 2:00 – ማታ 12:00',
    },
    { days: 'Sunday', daysAm: 'እሑድ', time: 'Closed', timeAm: 'ዝግ' },
  ] as HoursLine[],

  about: {
    text:
      'We supply quality construction materials at official, transparent prices. Sales, payment verification and truck dispatch all run through one modern system, so every order is tracked from the counter to the gate.',
    textAm:
      'ጥራት ያላቸውን የግንባታ እቃዎች በይፋዊና ግልጽ ዋጋ እናቀርባለን። ሽያጭ፣ የክፍያ ማረጋገጫና የመኪና ዝውውር በአንድ ዘመናዊ ሲስተም ስለሚመራ እያንዳንዱ ትዕዛዝ ከሽያጭ ቆጣሪ እስከ በር መውጫ ድረስ ይከታተላል።',
  },

  services: [
    {
      key: 'materials',
      title: 'Construction Materials',
      titleAm: 'የግንባታ እቃዎች ሽያጭ',
      desc: 'Cement, rebar, sand, blocks and more at official, transparent prices.',
      descAm: 'ሲሚንቶ፣ ብረት፣ አሸዋ፣ ብሎኬት እና ሌሎች እቃዎች በይፋዊና ግልጽ ዋጋ።',
    },
    {
      key: 'delivery',
      title: 'Truck Delivery',
      titleAm: 'የመኪና ማድረስ አገልግሎት',
      desc: 'Registered trucks deliver to your site, tracked from approval to gate exit.',
      descAm: 'የተመዘገቡ መኪናዎች እቃውን ወደ ሳይትዎ ያደርሳሉ፤ ከማጽደቅ እስከ በር መውጫ ድረስ ይከታተላል።',
    },
    {
      key: 'payments',
      title: 'Secure Payments & Credit',
      titleAm: 'ደህንነቱ የተጠበቀ ክፍያና ብድር',
      desc: 'Telebirr and CBE payments verified by an admin; credit for registered customers.',
      descAm: 'በቴሌብር እና በንግድ ባንክ የሚደረጉ ክፍያዎች በአስተዳዳሪ ይረጋገጣሉ፤ ለተመዘገቡ ደንበኞች ብድር አለ።',
    },
    {
      key: 'gate',
      title: 'Gate Pass Security',
      titleAm: 'የበር መውጫ ደህንነት',
      desc: 'Every load leaves with a gate pass confirmed by our security team.',
      descAm: 'እያንዳንዱ ጭነት በጥበቃ ቡድናችን በተረጋገጠ የበር መውጫ ደብዳቤ ይወጣል።',
    },
  ] as Service[],

  /** The first branch with `isMain` is shown as the Main Office. Add, remove or reorder freely. */
  branches: [
    {
      id: 'main',
      isMain: true,
      name: 'Main Office — Addis Ababa',
      nameAm: 'ዋና ቢሮ — አዲስ አበባ',
      address: 'Bole Sub-city, Addis Ababa, Ethiopia',
      addressAm: 'ቦሌ ክፍለ ከተማ፣ አዲስ አበባ፣ ኢትዮጵያ',
      directions:
        'Placeholder: near the main road junction, opposite the fuel station. Look for the Garvelgo sign at the gate.',
      directionsAm: 'ምሳሌ፦ ዋናው መንገድ መገናኛ አቅራቢያ፣ ከነዳጅ ማደያው ፊት ለፊት። በሩ ላይ የጋርቬልጎ ምልክት ይፈልጉ።',
      phone: '+251 91 000 0000',
      hours: 'Mon – Sat, 8:00 AM – 6:00 PM',
      hoursAm: 'ሰኞ – ቅዳሜ፣ ከጠዋቱ 2:00 – ማታ 12:00',
      lat: 9.03,
      lng: 38.74,
    },
    {
      id: 'bahirdar',
      name: 'Bahir Dar Branch',
      nameAm: 'የባሕር ዳር ቅርንጫፍ',
      address: 'Bahir Dar, Amhara Region, Ethiopia',
      addressAm: 'ባሕር ዳር፣ አማራ ክልል፣ ኢትዮጵያ',
      directions: 'Placeholder: along the main road into town, next to the building-materials market.',
      directionsAm: 'ምሳሌ፦ ወደ ከተማው በሚገባው ዋና መንገድ ላይ፣ ከግንባታ እቃ ገበያው ቀጥሎ።',
      phone: '+251 92 000 0001',
      hours: 'Mon – Sat, 8:00 AM – 6:00 PM',
      hoursAm: 'ሰኞ – ቅዳሜ፣ ከጠዋቱ 2:00 – ማታ 12:00',
      lat: 11.5936,
      lng: 37.3908,
    },
    {
      id: 'hawassa',
      name: 'Hawassa Branch',
      nameAm: 'የሀዋሳ ቅርንጫፍ',
      address: 'Hawassa, Sidama Region, Ethiopia',
      addressAm: 'ሀዋሳ፣ ሲዳማ ክልል፣ ኢትዮጵያ',
      directions: 'Placeholder: close to the industrial area, past the main roundabout.',
      directionsAm: 'ምሳሌ፦ ከኢንዱስትሪ ዞኑ አቅራቢያ፣ ዋናውን አደባባይ ካለፉ በኋላ።',
      phone: '+251 92 000 0002',
      hours: 'Mon – Sat, 8:00 AM – 6:00 PM',
      hoursAm: 'ሰኞ – ቅዳሜ፣ ከጠዋቱ 2:00 – ማታ 12:00',
      lat: 7.0621,
      lng: 38.4763,
    },
  ] as Branch[],
};

export const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;

export const mapEmbedUrl = (b: Branch) =>
  `https://www.google.com/maps?q=${encodeURIComponent(b.mapQuery ?? `${b.lat},${b.lng}`)}&z=15&output=embed`;

export const mapDirectionsUrl = (b: Branch) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.mapQuery ?? `${b.lat},${b.lng}`)}`;

export const mapOpenUrl = (b: Branch) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.mapQuery ?? `${b.lat},${b.lng}`)}`;
