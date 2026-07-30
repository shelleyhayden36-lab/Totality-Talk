// Blueprint SVG Renderer for Totality Talk Hologram Visuals
// Generates clean, isolated 3D holographic blueprint schematics based on claim subjects.
// Produces square 800x800 standalone 3D model visuals with NO stage UI, NO text boxes, NO framing cards.

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export type SubjectCategory = 
  | 'flat_earth'
  | 'cheese_earth'
  | 'telescope'
  | 'camera'
  | 'moon'
  | 'rocket'
  | 'shield'
  | 'phone'
  | 'food'
  | 'water'
  | 'car'
  | 'factory'
  | 'brain'
  | 'globe'
  | 'building'
  | 'env'
  | 'tech'
  | 'med'
  | 'econ'
  | 'policy'
  | 'physics'
  | 'general';

export function detectSubjectCategory(text: string): SubjectCategory {
  const t = text.toLowerCase();
  
  // Specific literal visual concepts:
  if (t.match(/flat earth|earth is flat|disk earth|flat world/)) return 'flat_earth';
  if (t.match(/cheese|swiss cheese|moon.*cheese|earth.*cheese/)) return 'cheese_earth';
  if (t.match(/telescope|observatory|spyglass|lens.*sky|look.*sky|look.*space|stargaz/)) return 'telescope';

  // Specific visual domain concepts:
  if (t.match(/camera|photo|video|surveill|film|lens|record|picture|optic|cctv|capture/)) return 'camera';
  if (t.match(/moon|lunar|crater|apollo|artemis|eclipse|tide|selene/)) return 'moon';
  if (t.match(/rocket|missile|launch|spacecraft|shuttle|propulsion|orbit|astro/)) return 'rocket';
  if (t.match(/shield|defens|protect|cyber|security|firewall|armor|guard|military|weapon|war|threat/)) return 'shield';
  if (t.match(/phone|mobile|cellular|5g|stream|broadcast|communi|antenna|signal|wifi|network|social/)) return 'phone';
  if (t.match(/food|agri|farm|crop|wheat|livestock|meat|diet|grain|harvest|nutrit|hunger|feed/)) return 'food';
  if (t.match(/water|ocean|sea|river|lake|glacier|ice|fluid|hydro|clean water|drought|flood|purif/)) return 'water';
  if (t.match(/car|vehicle|auto|transit|truck|traffic|ev|electric vehicle|highway|train|aviation|plane/)) return 'car';
  if (t.match(/factory|manufactur|robot|automat|industrial|assembly|conveyor|workforce|labor|plant/)) return 'factory';
  if (t.match(/brain|mind|psycholog|cognitive|neuro|mental|memory|thought|consciousness|synap/)) return 'brain';
  if (t.match(/globe|earth|world|planet|geopolit|map|country|nation|internat|border|sovereign/)) return 'globe';
  if (t.match(/building|city|urban|architect|skyline|housing|infrastructure|tower|construct|real estate/)) return 'building';
  
  // Standard domain categories:
  if (t.match(/solar|wind|carbon|climate|energy|nature|eco|sustainab|emission|green|environment|atmosphere/)) return 'env';
  if (t.match(/ai|artificial|comput|code|software|algorithm|neural|data|machine|cloud|tech|model|intellig/)) return 'tech';
  if (t.match(/health|disease|gene|dna|vaccine|med|virus|biol|treat|clinic|patient|cancer|pharma|bio|cell|organ|syndrome/)) return 'med';
  if (t.match(/econ|tax|inflat|market|money|trade|gdp|cost|wealth|busin|bank|financ|price|dollar|curr|invest|crypto|bitcoin/)) return 'econ';
  if (t.match(/govern|law|right|polic|court|educat|school|democr|freedom|justic|reform|societ|regulat|vote|state|speech|legal/)) return 'policy';
  if (t.match(/quantum|physic|atom|nuclear|molecu|gravity|relativ|mass|energy|particle|laser/)) return 'physics';
  
  return 'general';
}

function renderCategorySchematic(cat: SubjectCategory, color: string, filterId: string): string {
  switch (cat) {
    case 'flat_earth':
      return `
        <!-- FLAT EARTH DISK SCHEMATIC -->
        <g filter="url(#${filterId})">
          <!-- Outer Grid Projection Sphere Ring -->
          <ellipse cx="400" cy="400" rx="310" ry="240" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="8 6" opacity="0.4" />

          <!-- Main Flat Disk World Body -->
          <ellipse cx="400" cy="420" rx="260" ry="85" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="4" />
          <ellipse cx="400" cy="450" rx="260" ry="85" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="10 5" opacity="0.6" />

          <!-- Ice Wall Ring around Flat Earth Edge -->
          <path d="M 140,420 L 140,450 A 260 85 0 0 0 660,450 L 660,420 A 260 85 0 0 1 140,420 Z" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="3" />

          <!-- Flat Continents on Surface -->
          <path d="M 280,410 C 300,380 340,390 360,410 C 370,425 340,435 300,430 Z" fill="${color}" fill-opacity="0.5" stroke="${color}" stroke-width="2" />
          <path d="M 420,390 C 460,375 520,385 540,410 C 510,430 450,435 410,410 Z" fill="${color}" fill-opacity="0.5" stroke="${color}" stroke-width="2" />
          <path d="M 330,435 C 370,430 420,440 400,455 C 360,460 320,450 330,435 Z" fill="${color}" fill-opacity="0.5" stroke="${color}" stroke-width="2" />

          <!-- Compass Rose & Surface Grid Lines -->
          <ellipse cx="400" cy="420" rx="180" ry="55" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="6 4" />
          <ellipse cx="400" cy="420" rx="100" ry="30" fill="none" stroke="${color}" stroke-width="1.5" />
          <line x1="140" y1="420" x2="660" y2="420" stroke="${color}" stroke-width="2" stroke-dasharray="4 4" />
          <line x1="400" y1="335" x2="400" y2="505" stroke="${color}" stroke-width="2" stroke-dasharray="4 4" />

          <!-- Sun & Moon Spotlight Orbits Above Disk -->
          <circle cx="310" cy="270" r="18" fill="${color}" />
          <line x1="310" y1="288" x2="310" y2="390" stroke="${color}" stroke-width="2" stroke-dasharray="4 4" />
          <ellipse cx="310" cy="390" rx="35" ry="12" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5" />

          <circle cx="490" cy="290" r="12" fill="none" stroke="${color}" stroke-width="2" />
          <line x1="490" y1="302" x2="490" y2="405" stroke="${color}" stroke-width="1.5" stroke-dasharray="4 4" />

          <!-- Dome Canopy Curve -->
          <path d="M 140,420 A 260 220 0 0 1 660,420" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="8 6" opacity="0.6" />

          <!-- Callout Label -->
          <line x1="520" y1="390" x2="620" y2="310" stroke="${color}" stroke-width="2" />
          <text x="625" y="305" font-size="14" font-weight="900" fill="#ffffff">FLAT EARTH MODEL DISK</text>
          <text x="625" y="325" font-size="12" font-weight="700" fill="${color}">CIRCULAR ICE RIM BOUNDARY</text>
        </g>
      `;

    case 'cheese_earth':
      return `
        <!-- CHEESE MOON / EARTH SCHEMATIC -->
        <g filter="url(#${filterId})">
          <!-- Main Cheese Globe Body -->
          <circle cx="400" cy="400" r="210" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="4" />
          <circle cx="400" cy="400" r="210" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="12 6" />

          <!-- Swiss Cheese Holes & Craters -->
          <circle cx="330" cy="320" r="45" fill="#05070a" stroke="${color}" stroke-width="3" />
          <circle cx="330" cy="320" r="32" fill="${color}" fill-opacity="0.2" />

          <circle cx="470" cy="350" r="55" fill="#05070a" stroke="${color}" stroke-width="3" />
          <circle cx="470" cy="350" r="40" fill="${color}" fill-opacity="0.2" />

          <circle cx="370" cy="480" r="38" fill="#05070a" stroke="${color}" stroke-width="3" />
          <circle cx="370" cy="480" r="26" fill="${color}" fill-opacity="0.2" />

          <circle cx="510" cy="470" r="28" fill="#05070a" stroke="${color}" stroke-width="2.5" />
          <circle cx="270" cy="420" r="30" fill="#05070a" stroke="${color}" stroke-width="2.5" />

          <!-- Wedge Slice Cutout Detail -->
          <path d="M 400,400 L 590,300 L 610,420 Z" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="3" />
          
          <!-- Latitude Grid overlay -->
          <ellipse cx="400" cy="400" rx="210" ry="70" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="6 4" />
          <ellipse cx="400" cy="400" rx="210" ry="140" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="6 4" />

          <!-- Callout Label -->
          <line x1="470" y1="350" x2="630" y2="230" stroke="${color}" stroke-width="2" />
          <text x="635" y="225" font-size="14" font-weight="900" fill="#ffffff">SWISS CHEESE MOON MATRIX</text>
          <text x="635" y="245" font-size="12" font-weight="700" fill="${color}">DENSE DAIRY CORE COMPOSITION</text>
        </g>
      `;

    case 'telescope':
      return `
        <!-- TELESCOPE SCHEMATIC -->
        <g filter="url(#${filterId})">
          <!-- Tripod Stand -->
          <line x1="400" y1="480" x2="220" y2="720" stroke="${color}" stroke-width="4" />
          <line x1="400" y1="480" x2="400" y2="740" stroke="${color}" stroke-width="4" />
          <line x1="400" y1="480" x2="580" y2="720" stroke="${color}" stroke-width="4" />
          <circle cx="400" cy="480" r="20" fill="${color}" fill-opacity="0.4" stroke="${color}" stroke-width="3" />

          <!-- Main Telescope Barrel (Angled at 40 degrees) -->
          <g transform="rotate(-35 400 450)">
            <rect x="220" y="420" width="360" height="60" rx="8" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="4" />
            <rect x="560" y="410" width="40" height="80" rx="6" fill="${color}" fill-opacity="0.4" stroke="${color}" stroke-width="3" />
            <rect x="180" y="435" width="40" height="30" rx="4" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="2" />

            <!-- Lens Aperture Glass -->
            <ellipse cx="580" cy="450" rx="12" ry="38" fill="${color}" stroke="${color}" stroke-width="3" />

            <!-- Finder Scope -->
            <rect x="340" y="390" width="120" height="22" rx="4" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2" />
          </g>

          <!-- Light Ray Cone extending into space -->
          <polygon points="560,280 750,120 780,210" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2" stroke-dasharray="6 4" />

          <!-- Target Scope Reticle -->
          <circle cx="680" cy="180" r="45" fill="none" stroke="${color}" stroke-width="2" />
          <line x1="680" y1="120" x2="680" y2="240" stroke="${color}" stroke-width="1.5" />
          <line x1="620" y1="180" x2="740" y2="180" stroke="${color}" stroke-width="1.5" />

          <!-- Callout Label -->
          <line x1="480" y1="360" x2="600" y2="460" stroke="${color}" stroke-width="2" />
          <text x="605" y="465" font-size="14" font-weight="900" fill="#ffffff">ASTRONOMICAL TELESCOPE</text>
          <text x="605" y="485" font-size="12" font-weight="700" fill="${color}">OPTICAL DEEP SPACE OBSERVATORY</text>
        </g>
      `;

    case 'camera':
      return `
        <g filter="url(#${filterId})">
          <circle cx="400" cy="400" r="190" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="4" />
          <circle cx="400" cy="400" r="140" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="12 6" />
          <circle cx="400" cy="400" r="100" fill="none" stroke="${color}" stroke-width="3" />
          <circle cx="400" cy="400" r="60" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="2" />
          <circle cx="400" cy="400" r="28" fill="${color}" />

          <!-- Aperture Blades -->
          <path d="M 400,260 L 440,320 M 520,320 L 460,420 M 520,480 L 410,460 M 400,540 L 360,480 M 280,480 L 340,380 M 280,320 L 390,340" stroke="${color}" stroke-width="3" />

          <!-- Reticle Frame -->
          <path d="M 220,240 L 190,240 L 190,270 M 580,240 L 610,240 L 610,270 M 220,560 L 190,560 L 190,530 M 580,560 L 610,560 L 610,530" stroke="${color}" stroke-width="4" fill="none" />

          <text x="400" y="640" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">OPTICAL CAMERA SENSOR SCHEMATIC</text>
        </g>
      `;

    case 'moon':
      return `
        <g filter="url(#${filterId})">
          <circle cx="400" cy="400" r="190" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="4" />
          <circle cx="400" cy="400" r="190" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="10 5" />

          <ellipse cx="350" cy="360" rx="45" ry="30" fill="#05070a" stroke="${color}" stroke-width="2.5" />
          <ellipse cx="480" cy="330" rx="32" ry="24" fill="#05070a" stroke="${color}" stroke-width="2.5" />
          <ellipse cx="430" cy="460" rx="55" ry="35" fill="#05070a" stroke="${color}" stroke-width="2.5" />

          <!-- Orbital Satellites -->
          <ellipse cx="400" cy="400" rx="310" ry="95" transform="rotate(-20 400 400)" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="8 4" />
          <circle cx="640" cy="300" r="12" fill="${color}" />

          <text x="400" y="650" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">LUNAR SURFACE MAP &amp; ORBITAL PATH</text>
        </g>
      `;

    case 'rocket':
      return `
        <g filter="url(#${filterId})">
          <!-- Rocket Body -->
          <path d="M 400,180 Q 435,260 440,430 L 440,550 L 360,550 L 360,430 Q 365,260 400,180 Z" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="4" />
          <line x1="360" y1="550" x2="310" y2="620" stroke="${color}" stroke-width="4" />
          <line x1="440" y1="550" x2="490" y2="620" stroke="${color}" stroke-width="4" />
          <polygon points="370,550 430,550 400,660" fill="${color}" fill-opacity="0.4" stroke="${color}" stroke-width="2" />

          <!-- Trajectory Arc -->
          <path d="M 180,600 Q 300,200 620,160" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="10 5" />

          <text x="400" y="700" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">AEROSPACE PROPULSION BLUEPRINT</text>
        </g>
      `;

    case 'shield':
      return `
        <g filter="url(#${filterId})">
          <path d="M 400,180 L 580,250 L 540,510 C 480,610 400,650 400,650 C 400,650 320,610 260,510 L 220,250 Z" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="4" />
          <path d="M 400,220 L 540,280 L 510,480 C 460,560 400,590 400,590 C 400,590 340,560 290,480 L 260,280 Z" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="8 4" />

          <!-- Lock Icon in Center -->
          <rect x="360" y="400" width="80" height="70" rx="8" fill="${color}" fill-opacity="0.4" stroke="${color}" stroke-width="3" />
          <path d="M 375,400 L 375,360 C 375,335 425,335 425,360 L 425,400" fill="none" stroke="${color}" stroke-width="4" />

          <text x="400" y="700" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">CYBERSECURITY DEFENSE MATRIX</text>
        </g>
      `;

    case 'phone':
      return `
        <g filter="url(#${filterId})">
          <rect x="290" y="190" width="220" height="420" rx="28" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="4" />
          <rect x="310" y="230" width="180" height="320" rx="12" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="6 4" />

          <!-- Wireless Signal Waves -->
          <path d="M 220,260 A 180 180 0 0 1 580,260" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="10 5" />
          <path d="M 250,290 A 140 140 0 0 1 550,290" fill="none" stroke="${color}" stroke-width="2" />

          <text x="400" y="660" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">WIRELESS COMMUNICATIONS HUD</text>
        </g>
      `;

    case 'food':
      return `
        <g filter="url(#${filterId})">
          <!-- Molecular Bond Food Matrix -->
          <circle cx="400" cy="330" r="55" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="3" />
          <circle cx="270" cy="460" r="45" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="3" />
          <circle cx="530" cy="460" r="45" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="3" />

          <line x1="360" y1="370" x2="300" y2="430" stroke="${color}" stroke-width="4" />
          <line x1="440" y1="370" x2="500" y2="430" stroke="${color}" stroke-width="4" />
          <line x1="315" y1="460" x2="485" y2="460" stroke="${color}" stroke-width="4" />

          <text x="400" y="620" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">AGRONOMIC BIO-SUSTAINABILITY MATRIX</text>
        </g>
      `;

    case 'water':
      return `
        <g filter="url(#${filterId})">
          <!-- Water Drop -->
          <path d="M 400,200 Q 400,290 490,410 C 490,480 440,540 400,540 C 360,540 310,480 310,410 Q 400,290 400,200 Z" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="4" />

          <!-- Ripple Waves Below -->
          <ellipse cx="400" cy="570" rx="240" ry="35" fill="none" stroke="${color}" stroke-width="2.5" />
          <ellipse cx="400" cy="570" rx="160" ry="22" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="6 4" />

          <text x="400" y="660" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">HYDROLOGICAL RESOURCE SCHEMATIC</text>
        </g>
      `;

    case 'car':
      return `
        <g filter="url(#${filterId})">
          <!-- Car Silhouette Wireframe -->
          <path d="M 180,480 L 220,410 L 320,340 L 500,340 L 580,410 L 640,480 Z" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="4" />
          <circle cx="270" cy="480" r="45" fill="#05070a" stroke="${color}" stroke-width="4" />
          <circle cx="530" cy="480" r="45" fill="#05070a" stroke="${color}" stroke-width="4" />

          <text x="400" y="600" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">AUTONOMOUS TRANSIT VEHICLE BLUEPRINT</text>
        </g>
      `;

    case 'factory':
      return `
        <g filter="url(#${filterId})">
          <!-- Robotic Arm -->
          <rect x="220" y="520" width="360" height="40" rx="8" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="3" />
          <circle cx="300" cy="420" r="35" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="3" />
          <line x1="300" y1="420" x2="480" y2="300" stroke="${color}" stroke-width="6" />
          <circle cx="480" cy="300" r="25" fill="${color}" />

          <text x="400" y="640" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">ROBOTIC INDUSTRIAL AUTOMATION GRID</text>
        </g>
      `;

    case 'brain':
      return `
        <g filter="url(#${filterId})">
          <!-- Brain Synapse Nodes -->
          <path d="M 400,210 C 510,210 570,290 570,390 C 570,490 510,550 400,550 C 290,550 230,490 230,390 C 230,290 290,210 400,210 Z" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="4" />
          <line x1="400" y1="210" x2="400" y2="550" stroke="${color}" stroke-width="2" stroke-dasharray="6 4" />

          <circle cx="320" cy="310" r="12" fill="${color}" />
          <circle cx="480" cy="310" r="12" fill="${color}" />
          <circle cx="340" cy="440" r="12" fill="${color}" />
          <circle cx="460" cy="440" r="12" fill="${color}" />

          <line x1="320" y1="310" x2="480" y2="310" stroke="${color}" stroke-width="2" />
          <line x1="320" y1="310" x2="340" y2="440" stroke="${color}" stroke-width="2" />
          <line x1="480" y1="310" x2="460" y2="440" stroke="${color}" stroke-width="2" />

          <text x="400" y="620" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">NEURO-COGNITIVE FUNCTIONAL MAP</text>
        </g>
      `;

    case 'globe':
      return `
        <g filter="url(#${filterId})">
          <circle cx="400" cy="400" r="210" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="4" />
          <ellipse cx="400" cy="400" rx="210" ry="80" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="8 4" />
          <ellipse cx="400" cy="400" rx="210" ry="150" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="8 4" />
          <ellipse cx="400" cy="400" rx="80" ry="210" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="8 4" />
          <line x1="190" y1="400" x2="610" y2="400" stroke="${color}" stroke-width="2" />

          <text x="400" y="660" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">GEOPOLITICAL WORLD SPHERE SCHEMATIC</text>
        </g>
      `;

    case 'building':
      return `
        <g filter="url(#${filterId})">
          <!-- Skyscraper Matrix -->
          <rect x="230" y="280" width="110" height="280" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="3" />
          <rect x="360" y="190" width="130" height="370" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="4" />
          <rect x="510" y="320" width="100" height="240" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="3" />

          <line x1="180" y1="560" x2="660" y2="560" stroke="${color}" stroke-width="4" />

          <text x="400" y="630" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">URBAN ARCHITECTURE STRUCTURAL MATRIX</text>
        </g>
      `;

    case 'physics':
      return `
        <g filter="url(#${filterId})">
          <!-- Quantum Atom -->
          <circle cx="400" cy="400" r="35" fill="${color}" />
          <ellipse cx="400" cy="400" rx="230" ry="80" fill="none" stroke="${color}" stroke-width="3" />
          <ellipse cx="400" cy="400" rx="230" ry="80" transform="rotate(60 400 400)" fill="none" stroke="${color}" stroke-width="3" />
          <ellipse cx="400" cy="400" rx="230" ry="80" transform="rotate(120 400 400)" fill="none" stroke="${color}" stroke-width="3" />

          <circle cx="620" cy="400" r="12" fill="${color}" />

          <text x="400" y="660" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">QUANTUM ATOMIC STRUCTURE</text>
        </g>
      `;

    default:
      return `
        <g filter="url(#${filterId})">
          <!-- Central Hexagon Lattice -->
          <polygon points="400,210 570,305 570,495 400,590 230,495 230,305" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="4" />
          <polygon points="400,260 520,330 520,470 400,540 280,470 280,330" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="8 4" />
          <circle cx="400" cy="400" r="45" fill="${color}" fill-opacity="0.4" stroke="${color}" stroke-width="3" />

          <line x1="400" y1="210" x2="400" y2="590" stroke="${color}" stroke-width="2" />
          <line x1="230" y1="305" x2="570" y2="495" stroke="${color}" stroke-width="2" />
          <line x1="230" y1="495" x2="570" y2="305" stroke="${color}" stroke-width="2" />

          <text x="400" y="660" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">HOLOGRAPHIC BLUEPRINT SCHEMATIC</text>
        </g>
      `;
  }
}

function buildSquareSvg(category: SubjectCategory, color: string, filterId: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" style="background:#05070a; font-family: system-ui, -apple-system, sans-serif;">
    <defs>
      <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <!-- Dark Studio Background -->
    <rect width="800" height="800" fill="#05070a" />

    <!-- Subtle Circular HUD Grid lines -->
    <g opacity="0.15" stroke="${color}" stroke-width="1" fill="none">
      <circle cx="400" cy="400" r="360" stroke-dasharray="10 6" />
      <circle cx="400" cy="400" r="270" stroke-dasharray="6 4" />
      <circle cx="400" cy="400" r="180" />
      <line x1="40" y1="400" x2="760" y2="400" stroke-dasharray="8 6" />
      <line x1="400" y1="40" x2="400" y2="760" stroke-dasharray="8 6" />
    </g>

    <!-- 3D SCHEMATIC MODEL -->
    ${renderCategorySchematic(category, color, filterId)}
  </svg>`;
}

export function generateAffirmativeHologramSvg(params: {
  claimText: string;
  speakerName?: string;
  topic?: string;
}): string {
  const category = detectSubjectCategory(params.claimText + ' ' + (params.topic || ''));
  const svg = buildSquareSvg(category, '#00f0ff', 'glowCyan');
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function generateOppositionHologramSvg(params: {
  claimText: string;
  speakerName?: string;
  topic?: string;
}): string {
  const category = detectSubjectCategory(params.claimText + ' ' + (params.topic || ''));
  const svg = buildSquareSvg(category, '#ff2a5f', 'glowRed');
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function generateEvidenceHologramSvg(params: {
  claimTitle?: string;
  evidenceSummary?: string;
  importantQuotes?: string;
  source?: string;
  judgeScore?: number;
  judgeResult?: string;
}): string {
  const textToScan = (params.claimTitle || '') + ' ' + (params.evidenceSummary || '');
  const category = detectSubjectCategory(textToScan);
  const svg = buildSquareSvg(category, '#10b981', 'glowEmerald');
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function convertSvgToPngDataUrl(svgStringOrDataUrl: string): string {
  return svgStringOrDataUrl;
}

export function generateAffirmativeHologramPng(params: { claimText: string; speakerName?: string; topic?: string }): string {
  return generateAffirmativeHologramSvg(params);
}

export function generateOppositionHologramPng(params: { claimText: string; speakerName?: string; topic?: string }): string {
  return generateOppositionHologramSvg(params);
}

export function generateEvidenceHologramPng(params: { claimTitle?: string; evidenceSummary?: string }): string {
  return generateEvidenceHologramSvg(params);
}
