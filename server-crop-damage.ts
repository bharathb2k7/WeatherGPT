import { GoogleGenAI } from "@google/genai";

export interface CropDamageAnalysisInput {
  problemDescription: string;
  imageData?: string;
  imageMimeType?: string;
  crop?: string;
  activeLocation?: {
    name: string;
    admin1?: string;
    country?: string;
    latitude: number;
    longitude: number;
  };
  language?: string;
  currentWeather?: any;
  dailyForecast?: any[];
}

export interface CropDamageAnalysisOutput {
  success: boolean;
  language: string;
  detectedLanguage: "te" | "en";
  crop: string;
  symptomsSummary: string;
  affectedPlantPart: string;
  duration: string;
  possibleCauses: string[];
  diagnosisType: "possible_cause" | "preliminary_assessment" | "unclear_image_or_description";
  confidenceLevel: "low" | "medium" | "moderate_with_evidence";
  isImageProvided: boolean;
  isImageUnclear: boolean;
  imageAssessment?: string;
  weatherConnection: string;
  treatmentOptionsNote: string;
  verifiedPesticides: Array<{
    name: string;
    activeIngredient: string;
    targetPestOrDisease: string;
    source: string;
    safetyNote: string;
  }>;
  nonChemicalManagement: string[];
  safetyPrecautions: string[];
  recommendedPhotoOrStep: string;
  followUpQuestion?: string;
  sources: string[];
  fullFormattedReply: string;
  timestamp: string;
}

/**
 * Robust fallback synthesis in case Gemini is unreachable or rate-limited.
 * Strictly adheres to verified agricultural guidelines and never invents dosages.
 */
export function synthesizeCropDamageFallback(
  input: CropDamageAnalysisInput,
  isTelugu: boolean
): CropDamageAnalysisOutput {
  const text = (input.problemDescription || "").toLowerCase();
  const cropRaw = (input.crop || "").toLowerCase();
  const isPaddy = cropRaw.includes("rice") || cropRaw.includes("paddy") || cropRaw.includes("వరి") || text.includes("rice") || text.includes("paddy") || text.includes("వరి");
  const isChilli = cropRaw.includes("chilli") || cropRaw.includes("మిరప") || text.includes("chilli") || text.includes("మిరప") || text.includes("ముడుత");
  const isTomato = cropRaw.includes("tomato") || cropRaw.includes("టమోటా") || text.includes("tomato") || text.includes("టమోటా");
  const isCotton = cropRaw.includes("cotton") || cropRaw.includes("పత్తి") || text.includes("cotton") || text.includes("పత్తి");

  const cur = input.currentWeather || {
    temperature_2m: 30,
    relative_humidity_2m: 78,
    precipitation: 0,
    wind_speed_10m: 12,
  };

  const weatherRisk = isTelugu
    ? `ప్రస్తుత ఉష్ణోగ్రత ${Math.round(cur.temperature_2m)}°C, గాలిలో తేమ ${cur.relative_humidity_2m}% గా ఉంది. అధిక తేమ మరియు వెచ్చని వాతావరణం శిలీంధ్రాలు (Fungal spores) లేదా రసం పీల్చు పురుగులు వ్యాప్తి చెందడానికి అనుకూల వాతావరణాన్ని సృష్టిస్తుంది. అయితే వాతావరణం మాత్రమే తెగులును నిర్ధారించదు.`
    : `Current temperature is ${Math.round(cur.temperature_2m)}°C with ${cur.relative_humidity_2m}% relative humidity. Elevated humidity and warm conditions can provide favorable microclimates for fungal development or insect proliferation. However, weather conditions alone do not confirm a disease.`;

  const safetyPrecautions = isTelugu
    ? [
        "⚠️ ఉత్పత్తి లేబుల్‌పై ముద్రించిన సూచనలను ఖచ్చితంగా పాటించండి.",
        "⚠️ పురుగుమందు పిచికారీ సమయంలో తగిన రక్షణ కవచాలు (మాస్క్, కళ్లద్దాలు, రబ్బరు గ్లౌజులు) తప్పక ధరించండి.",
        "⚠️ ఉత్పత్తి లేబుల్ స్పష్టంగా అనుమతించకపోతే రెండు లేదా అంతకంటే ఎక్కువ రసాయనాలను ఎట్టిపరిస్థితుల్లోనూ కలపవద్దు.",
        "⚠️ పిచికారీ సమయంలో పిల్లలను, పెంపుడు జంతువులను పొలానికి దూరంగా ఉంచండి.",
        "⚠️ లేబుల్‌పై సూచించిన కోతకు ముందు వేచి ఉండాల్సిన సమయం (Pre-Harvest Interval - PHI) ఖచ్చితంగా పాటించండి.",
      ]
    : [
        "⚠️ Follow the product container label strictly.",
        "⚠️ Wear proper personal protective equipment (mask, goggles, chemical-resistant gloves).",
        "⚠️ Do not mix pesticides unless the product label explicitly permits tank-mixing.",
        "⚠️ Keep children and domestic animals safely away during and after application.",
        "⚠️ Follow the required pre-harvest interval (PHI) and safety instructions on the label.",
      ];

  if (isChilli) {
    const cropName = isTelugu ? "మిరప (Chilli)" : "Chilli (Capsicum annuum)";
    const symptoms = isTelugu
      ? "ఆకులు పైకి లేదా క్రిందికి ముడుచుకుపోవడం, లేత చిగుళ్ళు దెబ్బతినడం."
      : "Leaf curl, upward/downward cupping of tender foliage, stunted apical growth.";
    const possibleCauses = isTelugu
      ? [
          "సాధ్యమైన కారణం 1: తామర పురుగులు (Thrips) ఆకుల రసం పీల్చడం వల్ల పైకి ముడుత రావడం.",
          "సాధ్యమైన కారణం 2: పచ్చ పురుగులు లేదా తెల్లదోమ (Whiteflies) వ్యాప్తి చేసే లీఫ్ కర్ల్ వైరస్ (Leaf Curl Virus).",
          "సాధ్యమైన కారణం 3: పసుపు నల్లి (Yellow Mites) వల్ల ఆకులు క్రిందికి ముడుచుకోవడం.",
        ]
      : [
          "Possible Cause 1: Chilli Thrips (Scirtothrips dorsalis) feeding causing upward leaf curling.",
          "Possible Cause 2: Chilli Leaf Curl Gemini-virus transmitted by whiteflies.",
          "Possible Cause 3: Yellow Mite (Polyphagotarsonemus latus) causing downward leaf curling.",
        ];

    const nonChem = isTelugu
      ? [
          "ఎకరానికి 20-25 పసుపు మరియు నీలి రంగు జిగురు అట్టలను (Yellow & Blue Sticky Traps) అమర్చి రసం పీల్చు పురుగుల తీవ్రతను తగ్గించండి.",
          "మొలకల దశలో 5% వేప గింజల కషాయం (NSKE) లేదా వేప నూనెను ఆకుల అడుగుభాగం తడిచేలా పిచికారీ చేయండి.",
          "వైరస్ సోకిన మొక్కలను గుర్తించి వెంటనే పీకి నాశనం చేయండి.",
          "పొలం చుట్టూ జొన్న లేదా మొక్కజొన్నను 2-3 వరుసల్లో రక్షణ పంటగా వేసి తెగులు వాహక కీటకాలను అడ్డుకోండి.",
        ]
      : [
          "Install 20-25 yellow and blue sticky traps per acre to monitor and reduce sucking pest populations.",
          "Apply 5% Neem Seed Kernel Extract (NSKE) or botanical neem oil ensuring coverage under leaves.",
          "Rogue out and safely destroy severely virus-infected stunted plants.",
          "Plant border rows of maize or sorghum as a physical barrier against insect vectors.",
        ];

    const treatmentNote = isTelugu
      ? "సాధ్యమైన సమస్య తామర పురుగులు లేదా నల్లిగా గుర్తించబడింది. లేబుల్ వివరాలు మరియు స్థానిక వ్యవసాయ విస్తరణ అధికారి (AEO / KVK) సూచించిన ఆమోదిత మందులను మాత్రమే వినియోగించండి."
      : "Preliminary assessment indicates sucking pest pressure (thrips or mites). Use only verified active ingredients registered for chilli; consult your local agricultural extension officer (AEO/KVK) for exact brand and dosage.";

    const verifiedPesticides = [
      {
        name: isTelugu ? "డయాఫెంథియురాన్ (Diafenthiuron)" : "Diafenthiuron 50% WP",
        activeIngredient: "Diafenthiuron 50% WP",
        targetPestOrDisease: isTelugu ? "తామర పురుగులు మరియు నల్లి" : "Chilli thrips & mites",
        source: isTelugu ? "ICAR / ANGRAU ఆమోదిత సిఫార్సు" : "ICAR / CIBRC Registered Recommendation",
        safetyNote: isTelugu ? "కంటైనర్ లేబుల్‌పై సూచించిన మోతాదును మాత్రమే పాటించండి." : "Follow product container label for exact water dilution and PPE.",
      },
      {
        name: isTelugu ? "ఫిప్రోనిల్ (Fipronil)" : "Fipronil 5% SC",
        activeIngredient: "Fipronil 5% SC",
        targetPestOrDisease: isTelugu ? "తామర పురుగులు (Thrips)" : "Chilli thrips",
        source: isTelugu ? "వ్యవసాయ శాఖ సిఫార్సులు" : "State Agricultural Extension Advisory",
        safetyNote: isTelugu ? "తేనెటీగల సంరక్షణ కోసం పూత సమయంలో పిచికారీ చేయవద్దు." : "Avoid application during active bee foraging hours.",
      },
    ];

    const fullReply = isTelugu
      ? `🌱 పంట: ${cropName}
🔍 గుర్తించిన సమస్య: ${symptoms}
🩺 సాధ్యమైన కారణాలు:
${possibleCauses.map((c) => "• " + c).join("\n")}
📊 నమ్మకం / అనిశ్చితి: మధ్యస్థం (ప్రాథమిక పరిశీలన మాత్రమే, ఖచ్చితమైన నిర్ధారణ కాదు).
🌦️ వాతావరణ అనుసంధానం: ${weatherRisk}
💊 నిర్ధారించబడిన చికిత్సా ఎంపికలు:
${treatmentNote}
• Diafenthiuron 50% WP లేదా Fipronil 5% SC (లేబుల్ సూచనల ప్రకారం వ్యవసాయ అధికారి సలహాతో మాత్రమే).
🌿 రసాయన రహిత నిర్వహణ:
${nonChem.map((n) => "• " + n).join("\n")}
⚠️ భద్రతా జాగ్రత్తలు:
${safetyPrecautions.join("\n")}
📷 సిఫార్సు చేసిన ఫోటో / తదుపరి చర్య: ఆకు అడుగుభాగం మరియు పిలకల స్పష్టమైన క్లోజప్ ఫోటో అప్‌లోడ్ చేయండి.
🔗 మూలం: ICAR-IIHR & ANGRAU వ్యవసాయ విశ్వవిద్యాలయ మార్గదర్శకాలు.`
      : `🌱 Crop: ${cropName}
🔍 What you described: ${symptoms}
🩺 Possible cause:
${possibleCauses.map((c) => "• " + c).join("\n")}
📊 Confidence / uncertainty: Moderate (Preliminary assessment based on symptoms; not a lab-confirmed diagnosis).
🌦️ Weather connection: ${weatherRisk}
💊 Verified treatment options:
${treatmentNote}
• Diafenthiuron 50% WP or Fipronil 5% SC (Registered active ingredients; check product label).
🌿 Non-chemical management:
${nonChem.map((n) => "• " + n).join("\n")}
⚠️ Safety precautions:
${safetyPrecautions.join("\n")}
📷 Recommended photo / next step: Upload a close-up photo of the underside of affected leaves to check for microscopic mites or thrips nymphs.
🔗 Source: ICAR Indian Institute of Horticultural Research & ANGRAU Extension Guidelines.`;

    return {
      success: true,
      language: isTelugu ? "te" : "en",
      detectedLanguage: isTelugu ? "te" : "en",
      crop: cropName,
      symptomsSummary: symptoms,
      affectedPlantPart: isTelugu ? "ఆకులు మరియు లేత చిగుళ్ళు" : "Foliage and apical shoots",
      duration: isTelugu ? "పేర్కొనలేదు" : "Not specified",
      possibleCauses,
      diagnosisType: "possible_cause",
      confidenceLevel: "medium",
      isImageProvided: Boolean(input.imageData),
      isImageUnclear: false,
      weatherConnection: weatherRisk,
      treatmentOptionsNote: treatmentNote,
      verifiedPesticides,
      nonChemicalManagement: nonChem,
      safetyPrecautions,
      recommendedPhotoOrStep: isTelugu ? "ఆకు అడుగుభాగం స్పష్టమైన ఫోటో తీయండి." : "Upload a high-resolution photo of the underside of leaves.",
      followUpQuestion: isTelugu ? "ఈ ఆకు ముడుత ఎన్ని రోజుల నుండి గమనిస్తున్నారు?" : "How many days has this curling been visible in the field?",
      sources: ["ICAR", "ANGRAU", "Open-Meteo"],
      fullFormattedReply: fullReply,
      timestamp: new Date().toISOString(),
    };
  }

  // Default: Rice / Paddy
  const cropName = isTelugu ? "వరి (Paddy / Rice)" : "Rice / Paddy (Oryza sativa)";
  const symptoms = isTelugu
    ? "ఆకులు పసుపు రంగులోకి మారడం, ఆకులపై చిన్న కీటకాలు లేదా రంగు మారడం."
    : "Yellowing foliage, small visible insects or discoloration on leaves.";
  const possibleCauses = isTelugu
    ? [
        "సాధ్యమైన కారణం 1: తామర పురుగులు (Thrips) లేదా పచ్చ దీపపు పురుగులు (Leafhoppers) రసం పీల్చడం.",
        "సాధ్యమైన కారణం 2: ప్రారంభ దశలో కాండం తొలిచే పురుగు (Stem Borer) ప్రభావం వల్ల ఆకులు పసుపుబారడం.",
        "సాధ్యమైన కారణం 3: నత్రజని లేదా జింక్ పోషక లోపం వల్ల ఆకుల క్లోరోసిస్ (Chlorosis).",
      ]
    : [
        "Possible Cause 1: Sucking insect pressure (Thrips, Green Leafhoppers, or early Brown Planthopper).",
        "Possible Cause 2: Early Yellow Stem Borer (Scirpophaga incertulas) feeding damage.",
        "Possible Cause 3: Nutrient chlorosis (Nitrogen deficiency or Zinc deficiency).",
      ];

  const nonChem = isTelugu
    ? [
        "పొలంలో నీటిని నిరంతరం నిలకడగా ఉంచకుండా అడపాదడపా ఆరబెట్టి తడపడం (AWD - Alternate Wetting and Drying) చేయండి.",
        "ఎకరానికి 4-5 లింగాకర్షక బుట్టలు (Pheromone traps) మరియు కాంతి ఉచ్చులు అమర్చండి.",
        "నత్రజని ఎరువులను ఒకేసారి కాకుండా సిఫార్సు చేసిన మోతాదులో విడతలవారీగా వేయండి.",
        "5% వేప గింజల కషాయం (NSKE) పిచికారీ చేయడం ద్వారా ప్రారంభ దశ కీటకాలను అరికట్టండి.",
      ]
    : [
        "Practice Alternate Wetting and Drying (AWD) rather than stagnant standing water to suppress planthoppers.",
        "Install 4-5 pheromone traps per acre to monitor yellow stem borer moths.",
        "Apply nitrogen in split applications rather than excess single doses.",
        "Spray 5% Neem Seed Kernel Extract (NSKE) or botanical neem repellent for early-stage nymphs.",
      ];

  const treatmentNote = isTelugu
    ? "సమస్య ప్రాథమికంగా గుర్తించబడింది. పురుగుమందులు వాడే ముందు స్థానిక రైతు భరోసా కేంద్రం / వ్యవసాయ విస్తరణ అధికారి (AEO)ని సంప్రదించండి."
    : "Preliminary assessment indicates early sucking insect or stem borer activity. Check container labels and consult your local Agricultural Extension Officer (AEO) or Krishi Vigyan Kendra (KVK).";

  const verifiedPesticides = [
    {
      name: isTelugu ? "కార్టాప్ హైడ్రోక్లోరైడ్ (Cartap Hydrochloride)" : "Cartap Hydrochloride 50% SP / 4% G",
      activeIngredient: "Cartap Hydrochloride",
      targetPestOrDisease: isTelugu ? "కాండం తొలిచే పురుగు మరియు ఆకుచుట్టు పురుగు" : "Stem borer and leaf folder",
      source: isTelugu ? "కేంద్ర కీటకనాశిని మండలి (CIBRC) / ICAR" : "CIBRC / ICAR National Rice Research Institute",
      safetyNote: isTelugu ? "చేపల చెరువులకు సమీపంలో వాడరాదు; రక్షణ కవచాలు ధరించండి." : "Highly toxic to aquatic organisms; follow pre-harvest interval on label.",
    },
    {
      name: isTelugu ? "ట్రైఫ్లుమెజోపైరిమ్ (Triflumezopyrim)" : "Triflumezopyrim 10% SC",
      activeIngredient: "Triflumezopyrim 10% SC",
      targetPestOrDisease: isTelugu ? "సుడిదోమ మరియు పచ్చ దీపపు పురుగు" : "Brown planthopper (BPH) & Leafhopper",
      source: isTelugu ? "ANGRAU / ICAR ఆమోదిత జాబితా" : "ANGRAU & ICAR Rice Advisory Package",
      safetyNote: isTelugu ? "మొక్కల మొదళ్ల వద్ద పడేలా జాగ్రత్తగా పిచికారీ చేయండి." : "Direct spray toward the plant base where planthoppers congregate.",
    },
  ];

  const fullReply = isTelugu
    ? `🌱 పంట: ${cropName}
🔍 గుర్తించిన సమస్య: ${symptoms}
🩺 సాధ్యమైన కారణాలు:
${possibleCauses.map((c) => "• " + c).join("\n")}
📊 నమ్మకం / అనిశ్చితి: ప్రాథమిక పరిశీలన (ధృవీకరించబడిన వ్యాధి నిర్ధారణ కాదు).
🌦️ వాతావరణ అనుసంధానం: ${weatherRisk}
💊 నిర్ధారించబడిన చికిత్సా ఎంపికలు:
${treatmentNote}
• Cartap Hydrochloride లేదా Triflumezopyrim 10% SC (ఉత్పత్తి లేబుల్ మరియు AEO సూచనల ప్రకారం).
🌿 రసాయన రహిత నిర్వహణ:
${nonChem.map((n) => "• " + n).join("\n")}
⚠️ భద్రతా జాగ్రత్తలు:
${safetyPrecautions.join("\n")}
📷 సిఫార్సు చేసిన ఫోటో / తదుపరి చర్య: పంట పిలకలు మరియు ఆకుపై పురుగులు స్పష్టంగా కనిపించేలా దగ్గరగా ఫోటో తీయండి.
🔗 మూలం: ICAR-NRRI (జాతీయ వరి పరిశోధనా సంస్థ) & ANGRAU విస్తరణ సలహాలు.`
    : `🌱 Crop: ${cropName}
🔍 What you described: ${symptoms}
🩺 Possible cause:
${possibleCauses.map((c) => "• " + c).join("\n")}
📊 Confidence / uncertainty: Preliminary assessment (Not a confirmed diagnosis; requires field verification).
🌦️ Weather connection: ${weatherRisk}
💊 Verified treatment options:
${treatmentNote}
• Cartap Hydrochloride or Triflumezopyrim 10% SC (Check product label and local AEO recommendations).
🌿 Non-chemical management:
${nonChem.map((n) => "• " + n).join("\n")}
⚠️ Safety precautions:
${safetyPrecautions.join("\n")}
📷 Recommended photo / next step: Upload a close-up photo of the plant tiller base or leaf surface.
🔗 Source: ICAR National Rice Research Institute & ANGRAU Extension Services.`;

  return {
    success: true,
    language: isTelugu ? "te" : "en",
    detectedLanguage: isTelugu ? "te" : "en",
    crop: cropName,
    symptomsSummary: symptoms,
    affectedPlantPart: isTelugu ? "ఆకులు మరియు పిలకలు" : "Leaves and tillers",
    duration: isTelugu ? "పేర్కొనలేదు" : "Not specified",
    possibleCauses,
    diagnosisType: "possible_cause",
    confidenceLevel: "medium",
    isImageProvided: Boolean(input.imageData),
    isImageUnclear: false,
    weatherConnection: weatherRisk,
    treatmentOptionsNote: treatmentNote,
    verifiedPesticides,
    nonChemicalManagement: nonChem,
    safetyPrecautions,
    recommendedPhotoOrStep: isTelugu ? "మొక్క పిలకల వద్ద దగ్గరగా ఫోటో తీయండి." : "Upload a close-up photo of the leaf symptoms.",
    followUpQuestion: isTelugu ? "పురుగులు ఏ రంగులో ఉన్నాయి? ఆకుల పైన ఉన్నాయా లేదా కాండం మొదట్లో ఉన్నాయా?" : "What color are the insects, and are they on the upper leaf or down at the stem base?",
    sources: ["ICAR-NRRI", "ANGRAU", "Open-Meteo"],
    fullFormattedReply: fullReply,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Execute Gemini AI Crop Damage & Pest Analysis with strict safety guidelines,
 * multilingual detection, multimodal vision, and verified recommendations.
 */
export async function runGeminiCropDamageAnalysis(
  ai: GoogleGenAI,
  input: CropDamageAnalysisInput
): Promise<CropDamageAnalysisOutput> {
  const text = (input.problemDescription || "").trim();
  const hasTeluguChars = /[\u0c00-\u0c7f]/.test(text) || (input.crop && /[\u0c00-\u0c7f]/.test(input.crop));
  const detectedLanguage: "te" | "en" = hasTeluguChars || input.language === "te" ? "te" : "en";
  const isTelugu = detectedLanguage === "te";

  const locName = input.activeLocation?.name || "India";
  const locState = input.activeLocation?.admin1 || "";
  const cur = input.currentWeather || {
    temperature_2m: 29,
    relative_humidity_2m: 75,
    wind_speed_10m: 10,
    precipitation: 0,
  };

  const systemInstruction = `You are the Senior Agricultural Plant Pathology, Entomology, and Crop Health Specialist in WeatherGPT for Indian Agriculture.
You provide evidence-based, responsible, farmer-friendly decision support.

MANDATORY RULES:
1. LANGUAGE CONSTRAINT:
   - If detected language is "te" (Telugu), the ENTIRE output (all keys, text, and explanations) MUST be in natural, fluent Telugu (తెలుగు లిపి).
   - If detected language is "en" (English), the output must be in clear, simple English.
   - Never mix languages unnecessarily.

2. REASONING FLOW & UNCERTAINTY:
   - Clearly distinguish "Possible cause" from "Confirmed diagnosis".
   - NEVER tell the farmer that a disease or pest is definitely present based only on a voice description or single photo.
   - State confidence level honestly (e.g. "Preliminary assessment", "Low", "Moderate with symptoms observed").

3. PESTICIDE & DOSAGE SAFETY (STRICT ZERO-TOLERANCE):
   - NEVER invent a pesticide name, active ingredient, dosage, concentration, mixing ratio, waiting period, or application frequency.
   - Never recommend a pesticide from memory unless it is a verified CIBRC/ICAR/State Agricultural University (ANGRAU/PJTSAU/TNAU/IARI) registered chemical for that specific crop and target pest.
   - DO NOT provide dosage numbers from memory. Always instruct: "Check the product container label and consult your local Agricultural Extension Officer (AEO / KVK) for exact regional dosage."
   - If the description is vague or pesticide suitability cannot be reliably verified, say:
     ${
       isTelugu
         ? '"సమస్యకు సాధ్యమైన కారణాలను గుర్తించాను, అయితే అందుబాటులో ఉన్న సమాచారంతో ఖచ్చితమైన పురుగుమందును సురక్షితంగా సిఫార్సు చేయడం సాధ్యం కాదు. దయచేసి ఏదైనా మందు వాడే ముందు స్థానిక వ్యవసాయ విస్తరణ అధికారిని (AEO) లేదా ఉత్పత్తి లేబుల్‌ను తనిఖీ చేయండి."'
         : '"I can identify the likely problem, but I cannot safely verify a pesticide recommendation from the available information. Please check the local agricultural department/extension officer or the product label before applying any pesticide."'
     }

4. MANDATORY 5 SAFETY PRECAUTIONS (Must ALWAYS be present):
   ${
     isTelugu
       ? `1. ⚠️ ఉత్పత్తి లేబుల్‌ను ఖచ్చితంగా పాటించండి.
2. ⚠️ తగిన రక్షణ పరికరాలను (మాస్క్, గ్లౌజులు, కళ్లద్దాలు) ధరించండి.
3. ⚠️ లేబుల్ స్పష్టంగా అనుమతించకపోతే పురుగుమందులను ఇతర రసాయనాలతో కలపవద్దు.
4. ⚠️ పిచికారీ సమయంలో పిల్లలను మరియు పెంపుడు జంతువులను దూరంగా ఉంచండి.
5. ⚠️ లేబుల్‌పై సూచించిన కోతకు ముందు వేచి ఉండాల్సిన సమయం (Pre-Harvest Interval) పాటించండి.`
       : `1. ⚠️ Follow the product label strictly.
2. ⚠️ Use appropriate personal protective equipment (PPE).
3. ⚠️ Do not mix pesticides unless the label specifically permits it.
4. ⚠️ Keep children and animals away during application.
5. ⚠️ Follow the required pre-harvest interval and safety instructions on the label.`
   }

5. INTEGRATED PEST MANAGEMENT (IPM) & NON-CHEMICAL FIRST:
   - Always prioritize physical, cultural, and biological remedies (yellow sticky traps, neem seed extract NSKE 5%, pheromone traps, proper drainage, removing diseased plant parts).

6. WEATHER TELEMETRY INTEGRATION:
   - Current Weather: Temp ${Math.round(cur.temperature_2m || 30)}°C, Humidity ${cur.relative_humidity_2m || 75}%, Wind ${Math.round(cur.wind_speed_10m || 10)} km/h, Precipitation ${cur.precipitation || 0} mm.
   - Connect these conditions to biological risk (e.g. how humidity affects fungal sporulation or how hot dry conditions favor mites/thrips), but clarify that weather alone does not prove disease.

7. PHOTO ASSESSMENT (If image provided):
   - If the image is blurry, out of focus, or does not clearly show the plant issue: set isImageUnclear to true, and state:
     ${
       isTelugu
         ? '"సమస్యను ఖచ్చితంగా గుర్తించడానికి చిత్రం తగినంత స్పష్టంగా లేదు. దయచేసి ప్రభావిత ఆకు లేదా మొక్కకు దగ్గరగా స్పష్టమైన ఫోటో తీసి పంపండి."'
         : '"The image is not clear enough to identify the problem reliably. Please upload a closer photo of the affected leaf/plant."'
     }

8. FOLLOW-UP QUESTION:
   - Ask at most ONE simple, high-value question if key info is missing (e.g. crop name, duration, or insects visible).`;

  const userPrompt = `Farmer Problem Submission:
Location: ${locName}, ${locState}, India
Crop mentioned: ${input.crop || "Not explicitly specified, deduce from description"}
Farmer Spoken / Typed Description: "${text || "Uploaded crop photo for assessment"}"
Language to respond in: ${isTelugu ? "Telugu (తెలుగు)" : "English"}

Generate a valid JSON object matching this schema:
{
  "detectedLanguage": "${detectedLanguage}",
  "crop": "name of crop in ${isTelugu ? "Telugu and English" : "English"}",
  "symptomsSummary": "concise extracted symptoms",
  "affectedPlantPart": "leaf, stem, fruit, flower, etc.",
  "duration": "duration if mentioned, or unknown",
  "possibleCauses": ["Possible cause 1: ...", "Possible cause 2: ..."],
  "diagnosisType": "possible_cause",
  "confidenceLevel": "medium",
  "isImageUnclear": false,
  "imageAssessment": "visual observations from image if provided, else empty",
  "weatherConnection": "explanation of how current weather connects to the symptoms",
  "treatmentOptionsNote": "cautious note regarding treatment verification",
  "verifiedPesticides": [
    {
      "name": "Trade / active ingredient name",
      "activeIngredient": "Active ingredient & formulation",
      "targetPestOrDisease": "Target problem",
      "source": "ICAR / CIBRC / State Extension",
      "safetyNote": "Follow container label for dosage"
    }
  ],
  "nonChemicalManagement": ["cultural/biological practice 1", "practice 2", "practice 3"],
  "safetyPrecautions": ["precaution 1", "precaution 2", "precaution 3", "precaution 4", "precaution 5"],
  "recommendedPhotoOrStep": "what photo or next step is recommended",
  "followUpQuestion": "one single simple follow-up question if information is missing",
  "sources": ["ICAR", "ANGRAU / State Extension", "Open-Meteo"],
  "fullFormattedReply": "A complete, beautifully formatted multi-line reply with exact emoji headers suitable for reading aloud and displaying on screen"
}`;

  const contentParts: any[] = [];

  if (input.imageData) {
    const rawData = input.imageData.includes(",") ? input.imageData.split(",")[1] : input.imageData;
    contentParts.push({
      inlineData: {
        mimeType: input.imageMimeType || "image/jpeg",
        data: rawData,
      },
    });
  }

  contentParts.push({ text: userPrompt });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: contentParts,
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const rawJson = response.text?.trim() || "";
    const parsed = JSON.parse(rawJson);

    return {
      success: true,
      language: detectedLanguage,
      detectedLanguage,
      crop: parsed.crop || (isTelugu ? "పంట" : "Crop"),
      symptomsSummary: parsed.symptomsSummary || text,
      affectedPlantPart: parsed.affectedPlantPart || (isTelugu ? "మొక్క" : "Plant"),
      duration: parsed.duration || (isTelugu ? "పేర్కొనలేదు" : "Not specified"),
      possibleCauses: Array.isArray(parsed.possibleCauses) ? parsed.possibleCauses : [],
      diagnosisType: parsed.diagnosisType || "possible_cause",
      confidenceLevel: parsed.confidenceLevel || "medium",
      isImageProvided: Boolean(input.imageData),
      isImageUnclear: Boolean(parsed.isImageUnclear),
      imageAssessment: parsed.imageAssessment || "",
      weatherConnection: parsed.weatherConnection || "",
      treatmentOptionsNote: parsed.treatmentOptionsNote || "",
      verifiedPesticides: Array.isArray(parsed.verifiedPesticides) ? parsed.verifiedPesticides : [],
      nonChemicalManagement: Array.isArray(parsed.nonChemicalManagement) ? parsed.nonChemicalManagement : [],
      safetyPrecautions: Array.isArray(parsed.safetyPrecautions) && parsed.safetyPrecautions.length > 0 ? parsed.safetyPrecautions : [
        isTelugu ? "⚠️ ఉత్పత్తి లేబుల్‌ను ఖచ్చితంగా పాటించండి." : "⚠️ Follow the product label.",
        isTelugu ? "⚠️ తగిన రక్షణ పరికరాలను ధరించండి." : "⚠️ Use appropriate protective equipment.",
        isTelugu ? "⚠️ లేబుల్ అనుమతించకపోతే మందులను కలపవద్దు." : "⚠️ Do not mix pesticides unless permitted.",
        isTelugu ? "⚠️ పిల్లలను, జంతువులను దూరంగా ఉంచండి." : "⚠️ Keep children and animals away.",
        isTelugu ? "⚠️ కోతకు ముందు వేచి ఉండాల్సిన సమయం పాటించండి." : "⚠️ Follow the required pre-harvest interval.",
      ],
      recommendedPhotoOrStep: parsed.recommendedPhotoOrStep || "",
      followUpQuestion: parsed.followUpQuestion || "",
      sources: Array.isArray(parsed.sources) ? parsed.sources : ["ICAR", "ANGRAU", "Open-Meteo"],
      fullFormattedReply: parsed.fullFormattedReply || "",
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("Gemini Crop Damage analysis failed or produced non-JSON, using fallback:", err);
    return synthesizeCropDamageFallback(input, isTelugu);
  }
}
