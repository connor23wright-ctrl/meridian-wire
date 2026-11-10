// Finds which countries a piece of text is about. Keys are ISO numeric codes,
// the same ids the map data uses.
import fs from 'node:fs';

const ALIASES = {
  '840': ['United States', 'U.S.', 'US', 'USA', 'America', 'American', 'Americans', 'Washington', 'White House', 'Pentagon', 'Trump'],
  '826': ['UK', 'U.K.', 'Britain', 'British', 'England', 'Scotland', 'Wales', 'London', 'Downing Street'],
  '643': ['Russian', 'Russians', 'Moscow', 'Kremlin', 'Putin'],
  '804': ['Ukrainian', 'Ukrainians', 'Kyiv', 'Zelensky', 'Zelenskyy', 'Kharkiv', 'Odesa'],
  '156': ['Chinese', 'Beijing', 'Xi Jinping'],
  '158': ['Taiwanese', 'Taipei'],
  '250': ['French', 'Paris', 'Macron'],
  '276': ['German', 'Germans', 'Berlin'],
  '380': ['Italian', 'Rome'],
  '724': ['Spanish', 'Madrid'],
  '620': ['Portuguese', 'Lisbon'],
  '056': ['Belgian', 'Brussels'],
  '528': ['Dutch', 'Amsterdam', 'The Hague'],
  '616': ['Polish', 'Warsaw', 'Krakow', 'Kraków'],
  '348': ['Hungarian', 'Budapest', 'Orban', 'Orbán'],
  '300': ['Greek', 'Athens'],
  '792': ['Turkish', 'Türkiye', 'Ankara', 'Istanbul', 'Erdogan', 'Erdoğan'],
  '376': ['Israeli', 'Israelis', 'Jerusalem', 'Tel Aviv', 'Netanyahu'],
  '275': ['Palestinian', 'Palestinians', 'Gaza', 'West Bank', 'Hamas', 'Ramallah'],
  '422': ['Lebanese', 'Beirut', 'Hezbollah'],
  '760': ['Syrian', 'Damascus', 'Aleppo'],
  '364': ['Iranian', 'Iranians', 'Tehran'],
  '368': ['Iraqi', 'Baghdad', 'Kurdistan'],
  '682': ['Saudi', 'Riyadh'],
  '887': ['Yemeni', 'Houthi', 'Houthis', 'Sanaa'],
  '784': ['UAE', 'Emirati', 'Dubai', 'Abu Dhabi'],
  '634': ['Qatari', 'Doha'],
  '818': ['Egyptian', 'Cairo'],
  '729': ['Sudanese', 'Khartoum', 'Darfur'],
  '728': ['South Sudan', 'South Sudanese', 'Juba'],
  '231': ['Ethiopian', 'Addis Ababa', 'Tigray'],
  '404': ['Kenyan', 'Nairobi'],
  '566': ['Nigerian', 'Lagos', 'Abuja'],
  '710': ['South African', 'Johannesburg', 'Pretoria', 'Cape Town'],
  '180': ['DR Congo', 'DRC', 'Democratic Republic of Congo', 'Democratic Republic of the Congo', 'Kinshasa', 'Goma'],
  '178': ['Republic of Congo', 'Brazzaville'],
  '140': ['Central African Republic'],
  '706': ['Somali', 'Mogadishu'],
  '434': ['Libyan', 'Tripoli'],
  '504': ['Moroccan', 'Rabat'],
  '012': ['Algerian', 'Algiers'],
  '788': ['Tunisian', 'Tunis'],
  '384': ['Ivory Coast', 'Ivorian'],
  '356': ['Indian', 'New Delhi', 'Delhi', 'Mumbai', 'Modi'],
  '586': ['Pakistani', 'Islamabad', 'Karachi'],
  '004': ['Afghan', 'Kabul', 'Taliban'],
  '050': ['Bangladeshi', 'Dhaka'],
  '144': ['Sri Lankan', 'Colombo'],
  '524': ['Nepali', 'Nepalese', 'Kathmandu'],
  '104': ['Burma', 'Burmese'],
  '764': ['Thai', 'Bangkok'],
  '704': ['Vietnamese', 'Hanoi'],
  '608': ['Philippine', 'Filipino', 'Manila'],
  '360': ['Indonesian', 'Jakarta'],
  '458': ['Malaysian', 'Kuala Lumpur'],
  '392': ['Japanese', 'Tokyo'],
  '410': ['South Korean', 'Seoul'],
  '408': ['North Korean', 'Pyongyang', 'Kim Jong Un'],
  '036': ['Australian', 'Canberra', 'Sydney', 'Melbourne'],
  '554': ['New Zealander', 'Wellington', 'Auckland'],
  '124': ['Canadian', 'Ottawa', 'Toronto'],
  '484': ['Mexican', 'Mexico City'],
  '076': ['Brazilian', 'Brasilia', 'Rio de Janeiro', 'Sao Paulo', 'São Paulo', 'Lula'],
  '032': ['Argentine', 'Argentinian', 'Buenos Aires', 'Milei'],
  '152': ['Chilean', 'Santiago'],
  '170': ['Colombian', 'Bogota', 'Bogotá'],
  '862': ['Venezuelan', 'Caracas', 'Maduro'],
  '604': ['Peruvian', 'Lima'],
  '192': ['Cuban', 'Havana'],
  '332': ['Haitian', 'Port-au-Prince'],
  '214': ['Dominican Republic'],
  '752': ['Swedish', 'Stockholm'],
  '578': ['Norwegian', 'Oslo'],
  '208': ['Danish', 'Copenhagen'],
  '246': ['Finnish', 'Helsinki'],
  '372': ['Irish', 'Dublin'],
  '756': ['Swiss', 'Geneva', 'Zurich', 'Davos'],
  '040': ['Austrian', 'Vienna'],
  '203': ['Czech Republic', 'Czech', 'Prague'],
  '642': ['Romanian', 'Bucharest'],
  '688': ['Serbian', 'Belgrade'],
  '112': ['Belarusian', 'Minsk', 'Lukashenko'],
  '268': ['Georgian', 'Tbilisi'],
  '051': ['Armenian', 'Yerevan'],
  '031': ['Azerbaijani', 'Baku'],
  '398': ['Kazakh', 'Astana'],
  '807': ['North Macedonia'],
  '070': ['Bosnia', 'Bosnian', 'Sarajevo'],
  '748': ['Eswatini', 'Swaziland'],
  '732': ['Western Sahara'],
  '226': ['Equatorial Guinea'],
  '090': ['Solomon Islands'],
  '626': ['East Timor'],
  '336': ['Vatican City', 'Holy See', 'Pope']
};

const DISPLAY = {
  '840': 'United States', '180': 'DR Congo', '728': 'South Sudan', '140': 'Central African Republic',
  '214': 'Dominican Republic', '070': 'Bosnia and Herzegovina', '226': 'Equatorial Guinea',
  '807': 'North Macedonia', '384': 'Ivory Coast', '748': 'Eswatini', '732': 'Western Sahara', '090': 'Solomon Islands'
};

export function loadGazetteer(topoPath) {
  const topo = JSON.parse(fs.readFileSync(topoPath, 'utf8'));
  const names = {};
  const terms = [];
  for (const g of topo.objects.countries.geometries) {
    if (g.id == null) continue;
    const id = String(g.id), name = g.properties.name;
    names[id] = name;
    if (!/\.|Antarctica/.test(name)) terms.push([name, id]);
  }
  for (const [id, list] of Object.entries(ALIASES)) for (const a of list) terms.push([a, id]);
  terms.sort((a, b) => b[0].length - a[0].length);   // longest first: "South Sudan" before "Sudan"
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const compiled = terms.map(([t, id]) => [new RegExp('(?<![\\p{L}\\p{N}])' + esc(t) + '(?![\\p{L}\\p{N}])', 'gu'), id]);
  // Returns ids, most-mentioned first (ties: earliest mention), at most `max`.
  function tag(text, max = 5) {
    let rest = text;
    const hit = new Map();
    for (const [re, id] of compiled) {
      rest = rest.replace(re, (m, off) => {
        const h = hit.get(id) || { n: 0, at: off };
        h.n += 1; h.at = Math.min(h.at, off); hit.set(id, h);
        return ' '.repeat(m.length);
      });
    }
    return [...hit.entries()].sort((a, b) => b[1].n - a[1].n || a[1].at - b[1].at).slice(0, max).map((e) => e[0]);
  }
  for (const [id, n] of Object.entries(DISPLAY)) if (names[id]) names[id] = n;
  return { tag, names };
}
