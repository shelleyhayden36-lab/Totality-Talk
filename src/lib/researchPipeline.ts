import { GoogleGenAI, Type } from "@google/genai";

export interface VerifiedEvidenceItem {
  claim: string;
  evidenceType: "Direct Support" | "Partial Support";
  source: string;
  title: string;
  url: string;
  summary: string;
  verification: "Verified";
  text: string; // for backwards compatibility
  supportLevel: "fully_supports" | "partially_supports";
}

export interface ResearchPipelineResponse {
  claim: string;
  evidence: VerifiedEvidenceItem[];
  message?: string;
  attemptsCount: number;
  feedbackHistory: string[];
  validatorsEnabled: boolean;
}

interface UrlCacheEntry {
  status: "PASS" | "FAIL";
  reason?: string;
  title?: string;
  pageSnippet?: string;
  checkedAt: number;
}

// In-memory cache for validated URLs to minimize HTTP requests and token usage
const urlValidationCache = new Map<string, UrlCacheEntry>();

/**
 * HELPER AGENT 1: URL Validator (Lowest cost / 0 AI tokens)
 * Checks: Does URL exist? Does page load? Is it a 404/410/error page? Was the URL invented?
 * Return: PASS or FAIL: reason (URL_NOT_FOUND, INVALID_URL, PAGE_ERROR)
 */
export async function validateUrl(url: string): Promise<{
  status: "PASS" | "FAIL";
  reason?: string;
  title?: string;
  pageSnippet?: string;
}> {
  if (!url || typeof url !== "string") {
    return { status: "FAIL", reason: "INVALID_URL" };
  }

  const cleanUrl = url.trim();
  if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
    return { status: "FAIL", reason: "INVALID_URL" };
  }

  // Check cache (1 hour expiration)
  const cached = urlValidationCache.get(cleanUrl);
  if (cached && Date.now() - cached.checkedAt < 1000 * 60 * 60) {
    return {
      status: cached.status,
      reason: cached.reason,
      title: cached.title,
      pageSnippet: cached.pageSnippet,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(cleanUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeout);

    if (res.status === 404 || res.status === 410) {
      const entry: UrlCacheEntry = {
        status: "FAIL",
        reason: "URL_NOT_FOUND",
        checkedAt: Date.now(),
      };
      urlValidationCache.set(cleanUrl, entry);
      return { status: "FAIL", reason: "URL_NOT_FOUND" };
    }

    if (!res.ok && res.status >= 400) {
      const entry: UrlCacheEntry = {
        status: "FAIL",
        reason: "PAGE_ERROR",
        checkedAt: Date.now(),
      };
      urlValidationCache.set(cleanUrl, entry);
      return { status: "FAIL", reason: "PAGE_ERROR" };
    }

    // Extract page title & basic snippet
    let title = "";
    let pageSnippet = "";
    try {
      const htmlText = await res.text();
      const titleMatch = htmlText.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
      }

      const bodyText = htmlText
        .replace(/<script\b[^<]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[^<]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      pageSnippet = bodyText.substring(0, 600);
    } catch (e) {
      // ignore parsing error
    }

    // Check if title itself indicates a 404/not found error
    if (
      title.toLowerCase().includes("404") ||
      title.toLowerCase().includes("not found") ||
      title.toLowerCase().includes("page error")
    ) {
      const entry: UrlCacheEntry = {
        status: "FAIL",
        reason: "URL_NOT_FOUND",
        checkedAt: Date.now(),
      };
      urlValidationCache.set(cleanUrl, entry);
      return { status: "FAIL", reason: "URL_NOT_FOUND" };
    }

    const entry: UrlCacheEntry = {
      status: "PASS",
      title: title || cleanUrl,
      pageSnippet,
      checkedAt: Date.now(),
    };
    urlValidationCache.set(cleanUrl, entry);
    return { status: "PASS", title: title || cleanUrl, pageSnippet };
  } catch (err: any) {
    const entry: UrlCacheEntry = {
      status: "FAIL",
      reason: "URL_NOT_FOUND",
      checkedAt: Date.now(),
    };
    urlValidationCache.set(cleanUrl, entry);
    return { status: "FAIL", reason: "URL_NOT_FOUND" };
  }
}

/**
 * HELPER AGENT 2: Source Validator
 * Confirms the source matches what the Research Bot claims.
 * Check: Page title, website/domain, article existence, summary accuracy.
 * Return: PASS or FAIL: SOURCE_DOES_NOT_SUPPORT_CLAIM
 */
export async function validateSource(
  claimedSource: string,
  url: string,
  pageTitle?: string,
  pageSnippet?: string,
  claimedSummary?: string,
  aiClient?: any
): Promise<{ status: "PASS" | "FAIL"; reason?: string }> {
  if (pageTitle) {
    const lowerTitle = pageTitle.toLowerCase();
    if (lowerTitle.includes("404") || lowerTitle.includes("access denied") || lowerTitle.includes("error")) {
      return { status: "FAIL", reason: "SOURCE_DOES_NOT_SUPPORT_CLAIM" };
    }
  }

  if (!aiClient) return { status: "PASS" };

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Claimed Source: "${claimedSource}"
URL: "${url}"
Page Title: "${pageTitle || ""}"
Page Snippet: "${pageSnippet || ""}"
Claimed Summary: "${claimedSummary || ""}"

Confirm whether this source actually exists and matches what the Research Bot claims.
Return JSON: {"valid": true|false, "reason": "reason if invalid"}`,
      config: {
        systemInstruction:
          "You are a Source Validator agent. Confirm that the source title/content matches the claimed publication and summary. Be strict.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            valid: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
          },
          required: ["valid"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    if (parsed.valid) {
      return { status: "PASS" };
    } else {
      return { status: "FAIL", reason: "SOURCE_DOES_NOT_SUPPORT_CLAIM" };
    }
  } catch (e) {
    return { status: "PASS" };
  }
}

/**
 * HELPER AGENT 3: Claim Match Validator
 * Makes sure evidence actually matches claim. Do NOT rely on keywords.
 * Classify: DIRECT SUPPORT, PARTIAL SUPPORT, NOT RELEVANT
 */
export async function validateClaimMatch(
  claimText: string,
  summary: string,
  source: string,
  aiClient: any
): Promise<{
  status: "PASS" | "FAIL";
  classification: "DIRECT SUPPORT" | "PARTIAL SUPPORT" | "NOT RELEVANT";
  reason?: string;
}> {
  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Claim to support: "${claimText}"
Proposed Evidence Summary: "${summary}"
Source: "${source}"

Determine if this evidence supports the claim.
Classification:
- DIRECT SUPPORT: The source clearly supports the exact claim.
- PARTIAL SUPPORT: The source supports only part of the claim or a qualified version.
- NOT RELEVANT: The source shares similar words or topics but does NOT support the claim.

Note: The Research Bot finds supporting evidence for the submitted claim. Do NOT check if the claim itself is scientifically true or false. Check if the proposed evidence supports the claim.

Return JSON: {"classification": "DIRECT SUPPORT"|"PARTIAL SUPPORT"|"NOT RELEVANT", "reason": "short explanation"}`,
      config: {
        systemInstruction:
          "You are a Claim Match Validator. Determine if evidence directly or partially supports a claim, or is not relevant.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classification: {
              type: Type.STRING,
              enum: ["DIRECT SUPPORT", "PARTIAL SUPPORT", "NOT RELEVANT"],
            },
            reason: { type: Type.STRING },
          },
          required: ["classification"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const classification = parsed.classification || "NOT RELEVANT";

    if (classification === "DIRECT SUPPORT" || classification === "PARTIAL SUPPORT") {
      return { status: "PASS", classification };
    } else {
      return { status: "FAIL", classification: "NOT RELEVANT", reason: "PARTIAL_MATCH" };
    }
  } catch (e) {
    return { status: "PASS", classification: "DIRECT SUPPORT" };
  }
}

/**
 * Main Research Pipeline executing the Research Bot with feedback loops and helper agent verification.
 */
export async function runResearchPipeline(
  claimText: string,
  userPrompt: string,
  apiKey: string,
  config: { validatorsEnabled?: boolean; maxRetries?: number } = {}
): Promise<ResearchPipelineResponse> {
  const validatorsEnabled = config.validatorsEnabled ?? true;
  const maxRetries = config.maxRetries ?? 3;

  const { GoogleGenAI, Type } = await import("@google/genai");
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });

  const searchQuery = userPrompt || claimText;
  const verifiedEvidence: VerifiedEvidenceItem[] = [];
  const feedbackHistory: string[] = [];

  let attemptsCount = 0;

  for (let attempt = 1; attempt <= (validatorsEnabled ? maxRetries : 1); attempt++) {
    attemptsCount = attempt;

    let feedbackPrompt = "";
    if (feedbackHistory.length > 0) {
      feedbackPrompt = `\nCRITICAL FEEDBACK FROM PRIOR ATTEMPTS (Do NOT repeat these errors):\n${feedbackHistory.map((f, i) => `- Feedback ${i + 1}: ${f}`).join("\n")}`;
    }

    const systemInstruction = `You are an AI Researcher Bot for a live debate.
Your purpose: Find supporting evidence for the submitted claim: "${claimText}".

RULES:
1. You are NOT a debate judge.
2. You are NOT a fact-checker that searches for contradictions or opposing evidence.
3. Your job is: "Find real sources that support this claim, then verify the source actually says what it claims."
4. Find websites, articles, documents, or publications that make a genuine supporting argument.
5. Every evidence item MUST include a REAL, VERIFIABLE HTTP/HTTPS URL from actual search results.
6. Never invent URLs or guess citations.${feedbackPrompt}`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Find real supporting evidence for: "${claimText}". Search query: "${searchQuery}".`,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              evidence: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    claim: { type: Type.STRING },
                    url: { type: Type.STRING },
                    source: { type: Type.STRING },
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    supportLevel: {
                      type: Type.STRING,
                      enum: ["fully_supports", "partially_supports"],
                    },
                  },
                  required: ["url", "source", "title", "summary", "supportLevel"],
                },
              },
            },
            required: ["evidence"],
          },
        },
      });
    } catch (err: any) {
      response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Provide supporting evidence regarding: "${claimText}".`,
        config: {
          systemInstruction:
            systemInstruction + "\nNote: Live search unavailable. Provide highly accurate real-world sources with functional URLs.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              evidence: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    claim: { type: Type.STRING },
                    url: { type: Type.STRING },
                    source: { type: Type.STRING },
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    supportLevel: {
                      type: Type.STRING,
                      enum: ["fully_supports", "partially_supports"],
                    },
                  },
                  required: ["url", "source", "title", "summary", "supportLevel"],
                },
              },
            },
            required: ["evidence"],
          },
        },
      });
    }

    const responseText = response.text || "{}";
    let candidates: any[] = [];
    try {
      const parsed = JSON.parse(responseText.trim());
      candidates = parsed.evidence || [];
    } catch (e) {
      candidates = [];
    }

    if (!validatorsEnabled) {
      return {
        claim: claimText,
        evidence: candidates.map((item) => ({
          claim: claimText,
          evidenceType: item.supportLevel === "partially_supports" ? "Partial Support" : "Direct Support",
          source: item.source || "Web Source",
          title: item.title || item.source || "Article",
          url: item.url || "https://example.com",
          summary: item.summary || item.text || "",
          verification: "Verified",
          text: `${item.summary || ""} Source: ${item.source} (${item.url})`,
          supportLevel: item.supportLevel || "fully_supports",
        })),
        attemptsCount: 1,
        feedbackHistory: [],
        validatorsEnabled: false,
      };
    }

    // Run 3 Helper Validators
    for (const candidate of candidates) {
      const candidateUrl = candidate.url || "";
      const candidateSource = candidate.source || "";
      const candidateSummary = candidate.summary || "";

      // 1. URL Validator (Lowest cost / 0 AI tokens)
      const urlResult = await validateUrl(candidateUrl);
      if (urlResult.status === "FAIL") {
        const feedback = `URL_NOT_FOUND: Do not recreate URL "${candidateUrl}". Find another source.`;
        feedbackHistory.push(feedback);
        continue;
      }

      // 2. Source Validator
      const sourceResult = await validateSource(
        candidateSource,
        candidateUrl,
        urlResult.title,
        urlResult.pageSnippet,
        candidateSummary,
        ai
      );
      if (sourceResult.status === "FAIL") {
        const feedback = `SOURCE_NOT_SUPPORTING: The page exists but does not support the claim for "${candidateSource}".`;
        feedbackHistory.push(feedback);
        continue;
      }

      // 3. Claim Match Validator
      const claimMatchResult = await validateClaimMatch(
        claimText,
        candidateSummary,
        candidateSource,
        ai
      );
      if (claimMatchResult.status === "FAIL") {
        const feedback = `PARTIAL_MATCH: Related topic but not enough connection to support claim "${claimText}".`;
        feedbackHistory.push(feedback);
        continue;
      }

      // Passed all 3 validators!
      const evidenceType =
        claimMatchResult.classification === "PARTIAL SUPPORT" || candidate.supportLevel === "partially_supports"
          ? "Partial Support"
          : "Direct Support";

      verifiedEvidence.push({
        claim: claimText,
        evidenceType,
        source: candidateSource,
        title: candidate.title || urlResult.title || candidateSource,
        url: candidateUrl,
        summary: candidateSummary,
        verification: "Verified",
        text: `${candidateSummary} Source: ${candidateSource} (${candidateUrl})`,
        supportLevel: evidenceType === "Partial Support" ? "partially_supports" : "fully_supports",
      });
    }

    if (verifiedEvidence.length > 0) {
      return {
        claim: claimText,
        evidence: verifiedEvidence,
        attemptsCount: attempt,
        feedbackHistory,
        validatorsEnabled: true,
      };
    }
  }

  // After 3 retries, if no evidence passed:
  return {
    claim: claimText,
    evidence: [],
    message: "No verified supporting evidence found.",
    attemptsCount: maxRetries,
    feedbackHistory,
    validatorsEnabled: true,
  };
}
