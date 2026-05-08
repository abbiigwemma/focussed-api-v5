const express = require('express');
const cors = require('cors');
const swisseph = require('swisseph-v2');

const app = express();
app.use(cors());
app.use(express.json());

// Set ephemeris path to bundled files
swisseph.swe_set_ephe_path(__dirname + '/node_modules/swisseph-v2/ephe');

// ─── HD CONSTANTS ─────────────────────────────────────────────────────────────

const GATE_SEQ = [
  41,19,13,49,30,55,37,63,22,36,25,17,21,51,42,3,
  27,24,2,23,8,20,16,35,45,12,15,52,39,53,62,56,
  31,33,7,4,29,59,40,64,47,6,46,18,48,57,32,50,
  28,44,1,43,14,34,9,5,26,11,10,58,38,54,61,60
];

const WHEEL_OFFSET = 292.5;

const CHANNELS = [
  [64,47,'Head','Ajna'],[61,24,'Head','Ajna'],[63,4,'Head','Ajna'],
  [17,62,'Ajna','Throat'],[11,56,'Ajna','Throat'],[43,23,'Ajna','Throat'],
  [7,31,'G','Throat'],[1,8,'G','Throat'],[13,33,'G','Throat'],[10,20,'G','Throat'],
  [25,51,'G','Heart'],[21,45,'Heart','Throat'],[26,44,'Heart','Spleen'],
  [40,37,'Heart','SolarPlexus'],[34,20,'Sacral','Throat'],[34,57,'Sacral','Spleen'],
  [34,10,'Sacral','G'],[3,60,'Sacral','Root'],[5,15,'Sacral','G'],
  [14,2,'Sacral','G'],[27,50,'Sacral','Spleen'],[29,46,'Sacral','G'],
  [42,53,'Sacral','Root'],[9,52,'Sacral','Root'],[59,6,'Sacral','SolarPlexus'],
  [22,12,'SolarPlexus','Throat'],[36,35,'SolarPlexus','Throat'],
  [49,19,'SolarPlexus','Root'],[39,55,'SolarPlexus','Root'],
  [30,41,'SolarPlexus','Root'],[6,59,'SolarPlexus','Sacral'],
  [18,58,'Spleen','Root'],[28,38,'Spleen','Root'],[32,54,'Spleen','Root'],
  [48,16,'Spleen','Throat'],[57,34,'Spleen','Sacral'],[57,20,'Spleen','Throat'],
  [38,28,'Root','Spleen'],[53,42,'Root','Sacral'],[60,3,'Root','Sacral'],
  [52,9,'Root','Sacral'],[41,30,'Root','SolarPlexus'],[19,49,'Root','SolarPlexus'],
  [54,32,'Root','Spleen']
];

const CHANNEL_NAMES = {
  '3-60':'Mutation','5-15':'Rhythm','6-59':'Intimacy','7-31':'Alpha',
  '9-52':'Concentration','10-20':'Awakening','11-56':'Curiosity','12-22':'Openness',
  '13-33':'Prodigal','14-2':'Beat','16-48':'Wavelength','17-62':'Acceptance',
  '18-58':'Judgment','19-49':'Synthesis','20-34':'Charisma','20-57':'Brain Wave',
  '21-45':'Money Line','23-43':'Structuring','24-61':'Awareness','25-51':'Initiation',
  '26-44':'Surrender','27-50':'Preservation','28-38':'Struggle','29-46':'Discovery',
  '30-41':'Recognition','32-54':'Transformation','34-10':'Exploration','34-57':'Power',
  '35-36':'Transitoriness','37-40':'Community','39-55':'Emoting','41-30':'Fantasy',
  '42-53':'Maturation','43-23':'Structuring','44-26':'Surrender','45-21':'Money Line',
  '46-29':'Discovery','47-64':'Abstraction','48-16':'Wavelength','49-19':'Synthesis',
  '50-27':'Preservation','51-25':'Initiation','52-9':'Determination','53-42':'Cyclic',
  '54-32':'Transformation','55-39':'Emoting','56-11':'Curiosity','57-20':'Brain Wave',
  '57-34':'Archetype','58-18':'Judgment','59-6':'Mating','60-3':'Acceptance',
  '61-24':'Awareness','62-17':'Acceptance','63-4':'Logic','64-47':'Abstraction',
  '1-8':'Inspiration','2-14':'Beat','4-63':'Logic','8-1':'Inspiration'
};

const PROFILE_NAMES = {
  '1/3':'Investigator-Martyr','1/4':'Investigator-Opportunist',
  '2/4':'Hermit-Opportunist','2/5':'Hermit-Heretic',
  '3/5':'Martyr-Heretic','3/6':'Martyr-Role Model',
  '4/6':'Opportunist-Role Model','4/1':'Opportunist-Investigator',
  '5/1':'Heretic-Investigator','5/2':'Heretic-Hermit',
  '6/2':'Role Model-Hermit','6/3':'Role Model-Martyr'
};

const ZODIAC_SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
];

// ─── PROMISIFIED EPHEMERIS ────────────────────────────────────────────────────

function getJulianDay(year, month, day, hour) {
  return new Promise((resolve, reject) => {
    swisseph.swe_julday(year, month, day, hour, swisseph.SE_GREG_CAL, (jd) => {
      if (typeof jd === 'number') resolve(jd);
      else reject(new Error('Julian day calculation failed'));
    });
  });
}

function calcPlanet(jd, planetId) {
  return new Promise((resolve, reject) => {
    const flag = swisseph.SEFLG_SPEED | swisseph.SEFLG_SWIEPH;
    swisseph.swe_calc_ut(jd, planetId, flag, (result) => {
      if (result.error) reject(new Error(result.error));
      else resolve(result.longitude);
    });
  });
}

function calcHouses(jd, lat, lng) {
  return new Promise((resolve, reject) => {
    swisseph.swe_houses(jd, lat, lng, 'P', (result) => {
      if (result.error) reject(new Error(result.error));
      else resolve(result.ascendant);
    });
  });
}

// ─── HD HELPERS ───────────────────────────────────────────────────────────────

function lonToGateAndLine(lon) {
  const adj = ((lon - WHEEL_OFFSET) % 360 + 360) % 360;
  const gi  = Math.floor(adj / (360 / 64)) % 64;
  const gate = GATE_SEQ[gi];
  const posInGate = (adj % (360 / 64)) / (360 / 64);
  const line = Math.floor(posInGate * 6) + 1;
  return { gate, line, lon: parseFloat(lon.toFixed(4)) };
}

function lonToSign(lon) {
  const normalized = ((lon % 360) + 360) % 360;
  const sign = ZODIAC_SIGNS[Math.floor(normalized / 30)];
  const deg  = Math.floor(normalized % 30);
  const min  = Math.floor((normalized % 1) * 60);
  return { sign, deg, min, formatted: `${sign} ${deg}°${min}'` };
}

async function findDesignJD(birthJD) {
  const birthSunLon = await calcPlanet(birthJD, swisseph.SE_SUN);
  let lo = birthJD - 92, hi = birthJD - 84;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    const sunLon = await calcPlanet(mid, swisseph.SE_SUN);
    let diff = birthSunLon - sunLon;
    if (diff < 0) diff += 360;
    if (diff > 88) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function determineType(channels, centres) {
  const sacralDefined  = centres.has('Sacral');
  const sacralToThroat = channels.some(c =>
    (c.c1==='Sacral'&&c.c2==='Throat')||(c.c1==='Throat'&&c.c2==='Sacral'));
  const motorToThroat  = channels.some(c => {
    const motors = ['Heart','SolarPlexus','Spleen','Sacral'];
    return (motors.includes(c.c1)&&c.c2==='Throat')||(motors.includes(c.c2)&&c.c1==='Throat');
  });
  if (centres.size===0)              return 'Reflector';
  if (sacralDefined&&sacralToThroat) return 'Manifesting Generator';
  if (sacralDefined)                 return 'Generator';
  if (motorToThroat)                 return 'Manifestor';
  return 'Projector';
}

function determineAuthority(type, centres) {
  if (type==='Reflector') return 'Lunar';
  if (type==='Generator'||type==='Manifesting Generator')
    return centres.has('SolarPlexus') ? 'Emotional (Solar Plexus)' : 'Sacral';
  if (type==='Manifestor') {
    if (centres.has('SolarPlexus')) return 'Emotional (Solar Plexus)';
    if (centres.has('Heart'))       return 'Ego (Heart)';
    return 'Splenic';
  }
  if (type==='Projector') {
    if (centres.has('SolarPlexus')) return 'Emotional (Solar Plexus)';
    if (centres.has('Heart'))       return 'Ego (Heart)';
    if (centres.has('Spleen'))      return 'Splenic';
    if (centres.has('G'))           return 'Self-Projected';
    return 'Mental (Environmental)';
  }
  return 'Unknown';
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({ status:'Focussed. API running', version:'4.0.0', engine:'swisseph-v2 callback API' });
});

app.post('/api/chart', async (req, res) => {
  try {
    const { year, month, day, hour=12, utcOffset=0, lat=null, lng=null } = req.body;
    if (!year||!month||!day) return res.status(400).json({ error:'year, month and day are required' });

    const utcHour  = parseFloat(hour) - parseFloat(utcOffset);
    const birthJD  = await getJulianDay(parseInt(year), parseInt(month), parseInt(day), utcHour);
    const designJD = await findDesignJD(birthJD);

    const planetDefs = [
      { key:'Sun',     id: swisseph.SE_SUN      },
      { key:'Moon',    id: swisseph.SE_MOON     },
      { key:'Mercury', id: swisseph.SE_MERCURY  },
      { key:'Venus',   id: swisseph.SE_VENUS    },
      { key:'Mars',    id: swisseph.SE_MARS     },
      { key:'Jupiter', id: swisseph.SE_JUPITER  },
      { key:'Saturn',  id: swisseph.SE_SATURN   },
      { key:'Uranus',  id: swisseph.SE_URANUS   },
      { key:'Neptune', id: swisseph.SE_NEPTUNE  },
      { key:'Pluto',   id: swisseph.SE_PLUTO    },
      { key:'NNode',   id: swisseph.SE_TRUE_NODE },
    ];

    const conscious   = {};
    const unconscious = {};

    for (const { key, id } of planetDefs) {
      const birthLon  = await calcPlanet(birthJD,  id);
      const designLon = await calcPlanet(designJD, id);
      conscious[key]   = lonToGateAndLine(birthLon);
      unconscious[key] = lonToGateAndLine(designLon);

      if (key === 'Sun') {
        conscious['Earth']   = lonToGateAndLine((birthLon + 180) % 360);
        unconscious['Earth'] = lonToGateAndLine((designLon + 180) % 360);
      }
      if (key === 'NNode') {
        conscious['SNode']   = lonToGateAndLine((birthLon + 180) % 360);
        unconscious['SNode'] = lonToGateAndLine((designLon + 180) % 360);
      }
    }

    const allGates = new Set();
    for (const p of Object.keys(conscious)) {
      allGates.add(conscious[p].gate);
      allGates.add(unconscious[p].gate);
    }

    const activatedChannels = [];
    const definedCentres    = new Set();

    for (const [g1, g2, c1, c2] of CHANNELS) {
      if (allGates.has(g1) && allGates.has(g2)) {
        const key = `${Math.min(g1,g2)}-${Math.max(g1,g2)}`;
        activatedChannels.push({ g1, g2, c1, c2, name: CHANNEL_NAMES[key] || '' });
        definedCentres.add(c1);
        definedCentres.add(c2);
      }
    }

    const type      = determineType(activatedChannels, definedCentres);
    const authority = determineAuthority(type, definedCentres);

    const consciousSunLine   = conscious['Sun'].line;
    const unconsciousSunLine = unconscious['Sun'].line;
    const profileKey  = `${consciousSunLine}/${unconsciousSunLine}`;
    const profileName = PROFILE_NAMES[profileKey] || '';

    const sunBirthLon  = await calcPlanet(birthJD, swisseph.SE_SUN);
    const moonBirthLon = await calcPlanet(birthJD, swisseph.SE_MOON);
    const sunSign  = lonToSign(sunBirthLon);
    const moonSign = lonToSign(moonBirthLon);

    let risingSign = null;
    if (lat !== null && lng !== null) {
      const ascLon = await calcHouses(birthJD, parseFloat(lat), parseFloat(lng));
      risingSign = lonToSign(ascLon);
    }

    res.json({
      hd: {
        type, authority,
        profile: profileKey + (profileName ? ` · ${profileName}` : ''),
        definedCentres: [...definedCentres],
        channels: activatedChannels,
        conscious, unconscious,
        daysBack: parseFloat((birthJD - designJD).toFixed(2))
      },
      astrology: {
        sun: sunSign, moon: moonSign,
        rising: risingSign, hasRising: risingSign !== null
      },
      meta: {
        birthJD:      parseFloat(birthJD.toFixed(4)),
        designJD:     parseFloat(designJD.toFixed(4)),
        hasExactTime: parseFloat(hour) !== 12,
        hasLocation:  lat !== null && lng !== null,
        engine:       'swisseph-v2 callback'
      }
    });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Calculation failed' });
  }
});

app.get('/api/chart', (req, res) => {
  req.body = req.query;
  app.handle(Object.assign(req, { method: 'POST' }), res);
});

// ─── CLAUDE PROXY ─────────────────────────────────────────────────────────────
// Proxies requests to Anthropic API to avoid CORS issues from static sites

app.post('/api/claude', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Claude proxy error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Focussed. API v4 running on port ${PORT}`));
