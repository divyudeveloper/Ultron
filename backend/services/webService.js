const dns = require("dns").promises;
const net = require("net");

const WEB_TIMEOUT_MS = positiveNumber(process.env.WEB_TIMEOUT_MS, 15_000);
const MAX_WEB_CONTENT_BYTES = positiveNumber(process.env.MAX_WEB_CONTENT_BYTES, 2_000_000);
const SEARCH_ENRICHMENT_LIMIT = 5;
const WEB_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36",
    "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
    "Accept-Language":
        "en-US,en;q=0.9"
};

function positiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isPrivateIp(address) {
    const family = net.isIP(address);
    if (family === 4) {
        const [first, second] = address.split(".").map(Number);
        return first === 0 ||
            first === 10 ||
            first === 127 ||
            (first === 100 && second >= 64 && second <= 127) ||
            (first === 169 && second === 254) ||
            (first === 172 && second >= 16 && second <= 31) ||
            (first === 192 && second === 168) ||
            (first === 198 && (second === 18 || second === 19)) ||
            first >= 224;
    }

    if (family === 6) {
        const normalized = address.toLowerCase();
        if (normalized === "::1" || normalized === "::") return true;
        if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")) return true;

        const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        return Boolean(mappedIpv4 && isPrivateIp(mappedIpv4[1]));
    }

    return true;
}

async function assertSafePublicUrl(value) {
    let parsedUrl;
    try {
        parsedUrl = new URL(String(value || "").trim());
    } catch {
        throw new Error("Invalid URL.");
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Only HTTP and HTTPS URLs are supported.");
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
        throw new Error("Local network URLs are not allowed.");
    }

    if (parsedUrl.username || parsedUrl.password) {
        throw new Error("URLs with embedded credentials are not allowed.");
    }

    if (net.isIP(hostname)) {
        if (isPrivateIp(hostname)) throw new Error("Private network URLs are not allowed.");
        return parsedUrl;
    }

    let addresses;
    try {
        addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
        throw new Error("Hostname could not be resolved.");
    }

    if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
        throw new Error("Private network URLs are not allowed.");
    }

    return parsedUrl;
}

function isTextResponse(contentType) {
    const type = String(contentType || "").toLowerCase();
    return !type ||
        type.startsWith("text/") ||
        type.includes("application/xhtml+xml") ||
        type.includes("application/xml") ||
        type.includes("application/json") ||
        type.includes("application/rss+xml") ||
        type.includes("application/atom+xml");
}

async function fetchPublicUrl(url, headers) {
    let currentUrl = (await assertSafePublicUrl(url)).toString();

    for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
        const response = await fetch(currentUrl, {
            method: "GET",
            headers,
            redirect: "manual",
            signal: AbortSignal.timeout(WEB_TIMEOUT_MS)
        });

        if (![301, 302, 303, 307, 308].includes(response.status)) {
            return response;
        }

        const location = response.headers.get("location");
        if (!location) throw new Error("Redirect response had no destination URL.");
        currentUrl = (await assertSafePublicUrl(new URL(location, currentUrl))).toString();
    }

    throw new Error("Too many redirects.");
}

function safeFetchError(error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        return "Request timed out.";
    }
    return String(error?.message || "Request failed.");
}

function decodeHtmlEntities(value) {
    let source = String(value || "");

    return source
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&nbsp;/gi, " ")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#(\d+);/g, (_, code) => {
            try {
                return String.fromCharCode(Number(code));
            } catch {
                return " ";
            }
        })
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
            try {
                return String.fromCodePoint(parseInt(code, 16));
            } catch {
                return " ";
            }
        });
}

async function webRequest(url) {
    const requestedUrl = String(url || "").trim();

    if (!requestedUrl) {
        return {
            status: "error",
            message: "URL is required."
        };
    }

    console.log(`[ULTRON WEB] Opening: ${requestedUrl}`);

    try {
        const response = await fetchPublicUrl(requestedUrl, WEB_HEADERS);

        const contentType =
            String(response.headers.get("content-type") || "");

        console.log(
            `[ULTRON WEB] HTTP ${response.status} | ${response.url || requestedUrl}`
        );

        if (!response.ok) {
            return {
                status: "error",
                code: response.status,
                message:
                    `Webpage request failed with HTTP ${response.status}.`
            };
        }

        const declaredLength =
            Number(response.headers.get("content-length") || 0);

        if (declaredLength > MAX_WEB_CONTENT_BYTES) {
            return {
                status: "error",
                code: response.status,
                message: "Webpage is too large to process safely."
            };
        }

        if (!isTextResponse(contentType)) {
            return {
                status: "error",
                code: response.status,
                message: `Unsupported webpage content type: ${contentType || "unknown"}.`
            };
        }

        const content =
            await response.text();

        if (Buffer.byteLength(content, "utf8") > MAX_WEB_CONTENT_BYTES) {
            return {
                status: "error",
                code: response.status,
                message: "Webpage is too large to process safely."
            };
        }

        const finalUrl =
            response.url || requestedUrl;

        const metadata =
            extractPageMetadata(content, finalUrl);

        const readableContent =
            htmlToText(content);

        return {
            status: "success",
            url: finalUrl,
            requestedUrl,
            statusCode: response.status,
            contentType,

            title: metadata.title,
            description: metadata.description,
            canonicalUrl: metadata.canonicalUrl,
            publishedAt: metadata.publishedAt,
            modifiedAt: metadata.modifiedAt,

            content,
            readableContent,

            contentLength:
                readableContent.length
        };

    } catch (error) {
        console.error(
            "[ULTRON WEB] Request error:",
            error.message
        );

        return {
            status: "error",
            message:
                `Webpage access failed: ${safeFetchError(error)}`
        };
    }
}


function htmlToText(html) {
    let source =
        String(html || "");

    /*
     * =====================================================
     * ULTRON READABLE WEB CONTENT CLEANER
     * =====================================================
     *
     * Remove non-content browser code before converting HTML
     * into readable text. This prevents tracking libraries,
     * analytics code, advertisements and embedded widgets
     * from polluting webpageContent.
     */

    source =
        source
            // Executable / embedded code
            .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
            .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
            .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
            .replace(/<template\b[\s\S]*?<\/template>/gi, " ")
            .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
            .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, " ")

            // Navigation / non-article areas
            .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
            .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
            .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
            .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ")

            // Common advertisement / tracking containers
            .replace(
                /<(div|section|aside|span)[^>]*(?:class|id)=["'][^"']*(?:advert|ads|advertisement|ad-container|ad-wrapper|banner-ad|cookie|consent|newsletter|subscribe|social-share|share-buttons|related-content|recommended)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
                " "
            )

            // Common tracking / analytics custom elements
            .replace(
                /<(newrelic|nr-|gtm-|google-tag-manager|analytics)[^>]*>[\s\S]*?<\/[^>]+>/gi,
                " "
            )

            // Remove remaining HTML tags
            .replace(/<[^>]+>/g, " ")

            // Decode common HTML entities
            .replace(/&amp;/gi, "&")
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/&#x27;/gi, "'")
            .replace(/&nbsp;/gi, " ")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")

            .replace(/&#(\d+);/g, (_, code) => {
                try {
                    return String.fromCharCode(
                        Number(code)
                    );
                } catch {
                    return " ";
                }
            })

            // Remove obvious JavaScript-like fragments that
            // sometimes survive malformed webpage HTML.
            .replace(
                /\b(?:function|const|let|var)\s+[A-Za-z_$][\w$]*\s*[\s\S]{0,500}?(?:=>|return\s+|=\s*function)/gi,
                " "
            )

            .replace(
                /\b(?:window|document)\.(?:addEventListener|dispatchEvent|createElement|querySelector|querySelectorAll)\s*\([^)]*\)/gi,
                " "
            )

            // Remove excessive whitespace
            .replace(/\s+/g, " ")
            .trim();

    return source.trim();
}


function extractPageMetadata(html, baseUrl) {
    const source =
        String(html || "");

    let title = "";
    let description = "";
    let canonicalUrl = "";
    let publishedAt = "";
    let modifiedAt = "";

    const titleMatch =
        source.match(
            /<title\b[^>]*>([\s\S]*?)<\/title>/i
        );

    if (titleMatch && titleMatch[1]) {
        title =
            htmlToText(titleMatch[1])
                .trim();
    }

    const descriptionMatch =
        source.match(
            /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
        );

    if (
        descriptionMatch &&
        descriptionMatch[1]
    ) {
        description =
            htmlToText(
                descriptionMatch[1]
            ).trim();
    }

    if (!description) {
        const ogDescriptionMatch =
            source.match(
                /<meta\b[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i
            );

        if (
            ogDescriptionMatch &&
            ogDescriptionMatch[1]
        ) {
            description =
                htmlToText(
                    ogDescriptionMatch[1]
                ).trim();
        }
    }

    const canonicalMatch =
        source.match(
            /<link\b[^>]*rel=["'][^"']*\bcanonical\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i
        );

    if (
        canonicalMatch &&
        canonicalMatch[1]
    ) {
        try {
            canonicalUrl =
                new URL(
                    canonicalMatch[1],
                    baseUrl
                ).toString();
        } catch {
            canonicalUrl =
                canonicalMatch[1].trim();
        }
    }

    if (!canonicalUrl) {
        canonicalUrl =
            baseUrl;
    }

    /*
     * =====================================================
     * PUBLICATION DATE EXTRACTION
     * =====================================================
     *
     * Prefer explicit article metadata first.
     */

    const publishedMetaPatterns = [
        /<meta\b[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["'][^>]*>/i,
        /<meta\b[^>]*name=["']datePublished["'][^>]*content=["']([^"']+)["'][^>]*>/i,
        /<meta\b[^>]*itemprop=["']datePublished["'][^>]*content=["']([^"']+)["'][^>]*>/i,
        /<time\b[^>]*itemprop=["']datePublished["'][^>]*datetime=["']([^"']+)["'][^>]*>/i
    ];

    for (
        const pattern of publishedMetaPatterns
    ) {
        const match =
            source.match(pattern);

        if (
            match &&
            match[1]
        ) {
            publishedAt =
                match[1].trim();

            break;
        }
    }

    const modifiedMetaPatterns = [
        /<meta\b[^>]*property=["']article:modified_time["'][^>]*content=["']([^"']+)["'][^>]*>/i,
        /<meta\b[^>]*name=["']dateModified["'][^>]*content=["']([^"']+)["'][^>]*>/i,
        /<meta\b[^>]*itemprop=["']dateModified["'][^>]*content=["']([^"']+)["'][^>]*>/i,
        /<time\b[^>]*itemprop=["']dateModified["'][^>]*datetime=["']([^"']+)["'][^>]*>/i
    ];

    for (
        const pattern of modifiedMetaPatterns
    ) {
        const match =
            source.match(pattern);

        if (
            match &&
            match[1]
        ) {
            modifiedAt =
                match[1].trim();

            break;
        }
    }

    /*
     * Fallback to Schema.org JSON-LD.
     */
    if (
        !publishedAt ||
        !modifiedAt
    ) {
        const jsonLdMatches =
            source.match(
                /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
            ) || [];

        for (
            const block of jsonLdMatches
        ) {
            const jsonText =
                block
                    .replace(
                        /^<script\b[^>]*>/i,
                        ""
                    )
                    .replace(
                        /<\/script>$/i,
                        ""
                    )
                    .trim();

            try {
                const parsed =
                    JSON.parse(jsonText);

                const items =
                    Array.isArray(parsed)
                        ? parsed
                        : Array.isArray(parsed["@graph"])
                            ? parsed["@graph"]
                            : [parsed];

                for (
                    const item of items
                ) {
                    if (
                        item &&
                        typeof item === "object"
                    ) {
                        const rawType =
                            item["@type"];

                        const types =
                            Array.isArray(rawType)
                                ? rawType
                                : [rawType];

                        const articleLike =
                            types.some(
                                type =>
                                    [
                                        "Article",
                                        "NewsArticle",
                                        "BlogPosting",
                                        "TechArticle",
                                        "Report",
                                        "AnalysisNewsArticle"
                                    ].includes(
                                        String(type || "")
                                            .trim()
                                    )
                            );

                        if (
                            articleLike &&
                            !publishedAt &&
                            item.datePublished
                        ) {
                            publishedAt =
                                String(
                                    item.datePublished
                                ).trim();
                        }

                        if (
                            articleLike &&
                            !modifiedAt &&
                            item.dateModified
                        ) {
                            modifiedAt =
                                String(
                                    item.dateModified
                                ).trim();
                        }
                    }

                    if (
                        publishedAt &&
                        modifiedAt
                    ) {
                        break;
                    }
                }
            } catch {
                // Ignore malformed JSON-LD.
            }

            if (
                publishedAt &&
                modifiedAt
            ) {
                break;
            }
        }
    }

    return {
        title,
        description,
        canonicalUrl,
        publishedAt,
        modifiedAt
    };
}




function normalizeSearchUrl(url) {

    let resultUrl =
        String(url || "").trim();

    if (!resultUrl) {
        return "";
    }

    if (resultUrl.startsWith("//")) {
        resultUrl =
            "https:" + resultUrl;
    }

    try {

        const parsed =
            new URL(resultUrl);

        if (
            parsed.protocol !== "http:" &&
            parsed.protocol !== "https:"
        ) {
            return "";
        }

        const ddgTarget =
            parsed.searchParams.get("uddg");

        if (ddgTarget) {
            resultUrl =
                decodeURIComponent(ddgTarget);
        }

        const bingTarget =
            parsed.searchParams.get("u");

        if (
            bingTarget &&
            bingTarget.startsWith("a1")
        ) {

            try {

                const encoded =
                    bingTarget.slice(2);

                const decoded =
                    Buffer
                        .from(
                            encoded,
                            "base64"
                        )
                        .toString("utf8");

                if (
                    decoded.startsWith("http://") ||
                    decoded.startsWith("https://")
                ) {

                    resultUrl =
                        decoded;
                }

            } catch {
                // Keep original URL.
            }
        }

    } catch {
        return "";
    }

    try {
        const normalized =
            new URL(resultUrl);

        if (
            normalized.protocol !== "http:" &&
            normalized.protocol !== "https:"
        ) {
            return "";
        }

        normalized.hash = "";

        return normalized.toString();
    } catch {
        return "";
    }
}


function parseSearchResults(html) {

    const source =
        String(html || "");

    const results = [];
    const seenUrls = new Set();

    /*
     * Bing organic results:
     *
     * <li class="b_algo">
     *     <h2>
     *         <a href="...">Title</a>
     *     </h2>
     *     <div class="b_caption">
     *         <p>Snippet</p>
     *     </div>
     * </li>
     */

    const resultPattern =
        /<li\b[^>]*class=["'][^"']*\bb_algo\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;

    let match;

    while (
        (match = resultPattern.exec(source)) !== null &&
        results.length < 20
    ) {

        const block =
            String(match[1] || "");

        /*
         * Extract title + URL.
         */

        const titleMatch =
            block.match(
                /<h2\b[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i
            );

        if (!titleMatch) {
            continue;
        }

        const rawUrl =
            String(
                titleMatch[1] || ""
            ).trim();

        const title =
            htmlToText(
                titleMatch[2] || ""
            ).trim();

        if (
            !rawUrl ||
            !title
        ) {
            continue;
        }

        const decodedRawUrl =
            decodeHtmlEntities(rawUrl);

        const url =
            normalizeSearchUrl(decodedRawUrl);

        if (!url) {
            continue;
        }

        let parsedUrl;

        try {
            parsedUrl =
                new URL(url);
        } catch {
            continue;
        }

        const hostname =
            parsedUrl.hostname.toLowerCase();

        const pathname =
            parsedUrl.pathname.toLowerCase();

        /*
         * Skip Bing internal/tracking links.
         */

        const isBingInternal =
            (hostname === "bing.com" || hostname.endsWith(".bing.com")) &&
            (
                pathname.includes("/aclick") ||
                pathname.includes("/ads") ||
                pathname.includes("/ck/a")
            );

        if (
            isBingInternal
        ) {
            console.log(
                `[ULTRON WEB] Skipping Bing internal/ad result: ${title}`
            );

            continue;
        }

        /*
         * Extract snippet.
         */

        const snippetMatch =
            block.match(
                /<div\b[^>]*class=["'][^"']*\bb_caption\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
            );

        const snippet =
            snippetMatch
                ? htmlToText(
                    snippetMatch[1]
                ).trim()
                : "";

        /*
         * Skip obvious advertisements.
         */

        const titleLower =
            title.toLowerCase();

        const isAdTitle =
            titleLower.includes("advertisement") ||
            titleLower.includes("sponsored") ||
            titleLower.includes("promoted");

        if (
            isAdTitle
        ) {
            console.log(
                `[ULTRON WEB] Skipping ad result: ${title}`
            );

            continue;
        }

        const normalizedUrl =
            parsedUrl.toString();

        if (seenUrls.has(normalizedUrl)) {
            continue;
        }

        seenUrls.add(normalizedUrl);

        results.push({
            title,
            url: normalizedUrl,
            snippet
        });

        console.log(
            `[ULTRON WEB] Bing organic result ${results.length}: ${title} | ${normalizedUrl}`
        );
    }

    console.log(
        `[ULTRON WEB] Bing result parser found: ${results.length}`
    );

    return results.slice(0, 10);
}

function parseDuckDuckGoResults(html) {
    const source = String(html || "");
    const results = [];
    const seenUrls = new Set();
    const resultPattern =
        /<a\b[^>]*class=["'][^"']*\bresult__a\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let match;
    while ((match = resultPattern.exec(source)) !== null && results.length < 10) {
        const url = normalizeSearchUrl(decodeHtmlEntities(match[1]));
        const title = htmlToText(match[2]);
        if (!url || !title || seenUrls.has(url)) continue;

        seenUrls.add(url);
        results.push({ title, url, snippet: "" });
    }

    return results;
}

async function enrichSearchResults(query, results) {
    const baseResults =
        Array.isArray(results)
            ? results.slice(0, 10)
            : [];

    const resultsToEnrich =
        baseResults.slice(0, SEARCH_ENRICHMENT_LIMIT);

    const enriched =
        await Promise.all(
            resultsToEnrich.map(async (result) => {
                try {
                    console.log(
                        `[ULTRON WEB] Enriching result: ${result.url}`
                    );

                    const pageResult =
                        await webRequest(result.url);

                    return {
                        ...result,
                        pageTitle:
                            pageResult?.status === "success"
                                ? pageResult.title || result.title || ""
                                : result.title || "",
                        description:
                            pageResult?.status === "success"
                                ? pageResult.description || ""
                                : "",
                        readableContent:
                            pageResult?.status === "success"
                                ? String(pageResult.readableContent || "").slice(0, 12_000)
                                : "",
                        publishedAt:
                            pageResult?.status === "success"
                                ? pageResult.publishedAt || ""
                                : "",
                        modifiedAt:
                            pageResult?.status === "success"
                                ? pageResult.modifiedAt || ""
                                : ""
                    };
                } catch (error) {
                    console.log(
                        `[ULTRON WEB] Enrichment failed: ${result.url} | ${safeFetchError(error)}`
                    );

                    return {
                        ...result,
                        pageTitle: result.title || "",
                        description: "",
                        readableContent: "",
                        publishedAt: "",
                        modifiedAt: ""
                    };
                }
            })
        );

    const enrichedResults =
        baseResults.map((result, index) => {
            if (index < enriched.length) return enriched[index];
            return {
                ...result,
                pageTitle: result.title || "",
                description: "",
                readableContent: "",
                publishedAt: "",
                modifiedAt: ""
            };
        });

    console.log(
        `[ULTRON WEB] Date enrichment complete: ${enriched.length}/${baseResults.length} results`
    );

    return {
        status: "success",
        query,
        results: enrichedResults
    };
}

async function searchDuckDuckGo(query) {
    const url =
        "https://html.duckduckgo.com/html/?q=" +
        encodeURIComponent(query);

    try {
        const response =
            await fetchPublicUrl(url, WEB_HEADERS);

        if (!response.ok) {
            return [];
        }

        return parseDuckDuckGoResults(await response.text());
    } catch (error) {
        console.log(
            `[ULTRON WEB] DuckDuckGo fallback failed: ${safeFetchError(error)}`
        );
        return [];
    }
}

function prepareWebSearchQuery(query) {
    let value = String(query || "")
        .replace(/\s+/g, " ")
        .trim();

    if (!value) {
        return "";
    }

    /*
       Remove AI response instructions.
       Search engines should receive the actual topic,
       not the user's requested output format.
    */

    const instructionPatterns = [
        /\bfrom official web sources\b/gi,
        /\bfrom official sources\b/gi,
        /\bfrom web sources\b/gi,
        /\busing web sources\b/gi,
        /\busing official sources\b/gi,
        /\bwith sources\b/gi,
        /\bwith citations\b/gi,
        /\band give me\b/gi,
        /\bgive me\b/gi,
        /\bgive exactly \d+ concise findings\b/gi,
        /\bgive exactly \d+ findings\b/gi,
        /\bexactly \d+ concise findings\b/gi,
        /\bexactly \d+ findings\b/gi,
        /\ba concise answer\b/gi,
        /\bconcise answer\b/gi,
        /\bconcise response\b/gi,
        /\bshort answer\b/gi,
        /\bbrief answer\b/gi,
        /\breturn only\b/gi,
        /\bprovide a concise answer\b/gi,
        /\bprovide concise findings\b/gi,
        /\bsummarize\b/gi,
        /\band summarize\b/gi
    ];

    for (const pattern of instructionPatterns) {
        value = value.replace(pattern, " ");
    }

    /*
       Remove common filler phrases.
    */

    value = value
        .replace(/\bplease\b/gi, " ")
        .replace(/\bkindly\b/gi, " ")
        .replace(/\banswer\b/gi, " ")
        .replace(/\bresponse\b/gi, " ")
        .replace(/\bresearch\b/gi, " ")
        .replace(/\bsearch\b/gi, " ");

    /*
       Clean punctuation and whitespace.
    */

    value = value
        .replace(/[,;]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    /*
       Official-source targeting for technical queries.
       This prevents generic news results from dominating
       searches for software versions/releases.
    */

    const lowerValue = value.toLowerCase();

    if (
        (lowerValue.includes("node.js") ||
         lowerValue.includes("nodejs")) &&
        !lowerValue.includes("site:nodejs.org")
    ) {
        value += " site:nodejs.org";
    }

    if (
        lowerValue.includes("react") &&
        !lowerValue.includes("site:react.dev")
    ) {
        value += " site:react.dev";
    }

    if (
        lowerValue.includes("javascript") &&
        !lowerValue.includes("site:developer.mozilla.org")
    ) {
        value += " site:developer.mozilla.org";
    }

    if (
        lowerValue.includes("python") &&
        !lowerValue.includes("site:python.org")
    ) {
        value += " site:python.org";
    }

    if (
        lowerValue.includes("typescript") &&
        !lowerValue.includes("site:typescriptlang.org")
    ) {
        value += " site:typescriptlang.org";
    }

    /*
       Keep the query within a safe search length.
    */

    if (value.length > 300) {
        value = value.slice(0, 300).trim();
    }

    return value;
}

function getOfficialTechnicalFallbackResults(query) {
    const value = String(query || "").toLowerCase();
    const seeds = [];

    if (value.includes("node.js") || value.includes("nodejs") || value.includes("node lts")) {
        seeds.push(
            { title: "Node.js — Node.js Releases", url: "https://nodejs.org/en/about/previous-releases", snippet: "Official Node.js release and LTS information." },
            { title: "Node.js — Download", url: "https://nodejs.org/en/download", snippet: "Official Node.js downloads and release information." }
        );
    } else if (value.includes("javascript")) {
        seeds.push({ title: "JavaScript | MDN", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript", snippet: "Official MDN JavaScript documentation." });
    } else if (value.includes("react")) {
        seeds.push({ title: "React", url: "https://react.dev/", snippet: "Official React documentation." });
    } else if (value.includes("python")) {
        seeds.push({ title: "Python.org", url: "https://www.python.org/", snippet: "Official Python website." });
    } else if (value.includes("typescript")) {
        seeds.push({ title: "TypeScript", url: "https://www.typescriptlang.org/", snippet: "Official TypeScript website." });
    }

    return seeds;
}

function filterRelevantSearchResults(results, query) {
    if (!Array.isArray(results) || results.length === 0) {
        return [];
    }

    const queryText = String(query || "").toLowerCase();

    const wantsNode =
        queryText.includes("node.js") ||
        queryText.includes("nodejs");

    const wantsReact =
        queryText.includes("react");

    const wantsJavaScript =
        queryText.includes("javascript");

    const wantsPython =
        queryText.includes("python");

    const wantsTypeScript =
        queryText.includes("typescript");

    const technicalTerms = [];

    if (wantsNode) {
        technicalTerms.push(
            "node.js",
            "nodejs",
            "node",
            "npm",
            "node runtime",
            "node release",
            "node lts"
        );
    }

    if (wantsReact) {
        technicalTerms.push(
            "react",
            "reactjs",
            "react.dev"
        );
    }

    if (wantsJavaScript) {
        technicalTerms.push(
            "javascript",
            "ecmascript",
            "mdn"
        );
    }

    if (wantsPython) {
        technicalTerms.push(
            "python",
            "python.org",
            "python release",
            "python versions"
        );
    }

    if (wantsTypeScript) {
        technicalTerms.push(
            "typescript",
            "typescriptlang.org",
            "typescript release",
            "typescript version"
        );
    }

    /*
       For specific technical topics, require at least
       one meaningful topic match in title or URL.
    */

    if (technicalTerms.length === 0) {
        return results;
    }

    const scored = results
        .map((result, index) => {
            const title =
                String(result.title || "").toLowerCase();

            const url =
                String(result.url || "").toLowerCase();

            const combined =
                `${title} ${url}`;

            let score = 0;

            for (const term of technicalTerms) {
                if (title.includes(term)) {
                    score += 30;
                }

                if (url.includes(term)) {
                    score += 20;
                }
            }

            /*
               Strong official-source priority.
            */

            if (
                wantsNode &&
                (
                    url.includes("nodejs.org") ||
                    url.includes("nodejs.org/")
                )
            ) {
                score += 500;
            }

            if (
                wantsReact &&
                (
                    url.includes("react.dev") ||
                    url.includes("reactjs.org")
                )
            ) {
                score += 500;
            }

            if (
                wantsJavaScript &&
                url.includes("developer.mozilla.org")
            ) {
                score += 400;
            }

            if (
                wantsPython &&
                url.includes("python.org")
            ) {
                score += 500;
            }

            if (
                wantsTypeScript &&
                url.includes("typescriptlang.org")
            ) {
                score += 500;
            }

            /*
               Penalize generic news domains when they
               don't actually match the technical topic.
            */

            const genericNewsDomains = [
                "ndtv.com",
                "aajtak.in",
                "hindustantimes.com",
                "jansatta.com",
                "timesofindia.com",
                "indiatoday.in",
                "bbc.com",
                "news.google.com"
            ];

            const isGenericNews =
                genericNewsDomains.some(domain =>
                    url.includes(domain)
                );

            const hasTopicMatch =
                technicalTerms.some(term =>
                    combined.includes(term)
                );

            if (
                isGenericNews &&
                !hasTopicMatch
            ) {
                score -= 500;
            }

            return {
                result,
                index,
                score
            };
        })
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }

            return a.index - b.index;
        });

    /*
       Only keep technically relevant results.
    */

    const relevant =
        scored
            .filter(item => item.score > 0)
            .map(item => item.result);

    console.log(
        "[ULTRON WEB] Relevance filter:",
        {
            received: results.length,
            relevant: relevant.length,
            topScores: scored
                .slice(0, 5)
                .map(item => ({
                    title: item.result.title || "",
                    url: item.result.url || "",
                    score: item.score
                }))
        }
    );

    return relevant;
}
async function searchWeb(query) {
    const searchQuery =
        prepareWebSearchQuery(query);

    if (!searchQuery) {
        return {
            status: "error",
            message: "Search query is required."
        };
    }

    if (searchQuery.length > 500) {
        return {
            status: "error",
            query: searchQuery,
            message: "Search query is too long."
        };
    }

    console.log(
        `[ULTRON WEB] Searching: ${searchQuery}`
    );

    const searchUrl =
        "https://www.bing.com/search?q=" +
        encodeURIComponent(searchQuery);

    try {
        const response =
            await fetchPublicUrl(
                searchUrl,
                WEB_HEADERS
            );

        const declaredLength =
            Number(response.headers.get("content-length") || 0);

        if (declaredLength > MAX_WEB_CONTENT_BYTES) {
            const fallbackResults =
                await searchDuckDuckGo(searchQuery);

            if (fallbackResults.length) {
                return await enrichSearchResults(
                    searchQuery,
                    fallbackResults
                );
            }

            return {
                status: "error",
                code: response.status,
                message: "Search response is too large to process safely."
            };
        }

        const html =
            await response.text();

        if (Buffer.byteLength(html, "utf8") > MAX_WEB_CONTENT_BYTES) {
            return {
                status: "error",
                code: response.status,
                message: "Search response is too large to process safely."
            };
        }

        console.log(
            `[ULTRON WEB] Search HTTP status: ${response.status}`
        );

        console.log(
            `[ULTRON WEB] Search response length: ${html.length}`
        );

        console.log(
            `[ULTRON WEB] Search response preview: ${html.slice(0, 500).replace(/\s+/g, " ")}`
        );

        if (!response.ok) {
            const fallbackResults =
                await searchDuckDuckGo(searchQuery);

            if (fallbackResults.length) {
                return await enrichSearchResults(
                    searchQuery,
                    fallbackResults
                );
            }

            return {
                status: "error",
                code: response.status,
                message:
                    `Web search failed with HTTP ${response.status}; fallback search also returned no results.`
            };
        }

        let results =
            parseSearchResults(html);

        if (!results.length) {
            results =
                await searchDuckDuckGo(searchQuery);
        }

        console.log(
            `[ULTRON WEB] Search results parsed: ${results.length}`
        );

        /*
           Reject irrelevant search-engine results before
           webpage enrichment and AI research.
        */

        const relevantResults =
            filterRelevantSearchResults(
                results,
                searchQuery
            );

        /*
           If the search engine returned irrelevant technical
           results, try DuckDuckGo before giving up.
        */

        if (
            relevantResults.length === 0 &&
            (
                searchQuery.toLowerCase().includes("node.js") ||
                searchQuery.toLowerCase().includes("nodejs") ||
                searchQuery.toLowerCase().includes("react") ||
                searchQuery.toLowerCase().includes("javascript")
            )
        ) {
            console.log(
                "[ULTRON WEB] No relevant technical results from Bing. Trying DuckDuckGo fallback."
            );

            const fallbackResults =
                await searchDuckDuckGo(searchQuery);

            const relevantFallbackResults =
                filterRelevantSearchResults(
                    fallbackResults,
                    searchQuery
                );

            if (relevantFallbackResults.length) {
                console.log(
                    `[ULTRON WEB] DuckDuckGo relevant results: ${relevantFallbackResults.length}`
                );

                return await enrichSearchResults(
                    searchQuery,
                    relevantFallbackResults
                );
            }

            console.log(
                "[ULTRON WEB] DuckDuckGo also returned no relevant technical results."
            );
        }

        const technicalQuery =
            [
                "node.js",
                "nodejs",
                "react",
                "javascript",
                "python",
                "typescript"
            ].some(term =>
                searchQuery.toLowerCase().includes(term)
            );

        if (
            technicalQuery &&
            relevantResults.length === 0
        ) {
            const officialFallback =
                getOfficialTechnicalFallbackResults(searchQuery);

            if (officialFallback.length) {
                console.log(
                    `[ULTRON WEB] Using official technical fallback: ${officialFallback.length} results`
                );

                return await enrichSearchResults(
                    searchQuery,
                    officialFallback
                );
            }

            return {
                status: "success",
                query: searchQuery,
                results: []
            };
        }

        return await enrichSearchResults(
            searchQuery,
            relevantResults.length
                ? relevantResults
                : results
        );

    } catch (error) {
        console.error(
            "[ULTRON WEB] Search error:",
            error.message
        );

        const fallbackResults =
            await searchDuckDuckGo(searchQuery);

        if (fallbackResults.length) {
            return await enrichSearchResults(
                searchQuery,
                fallbackResults
            );
        }

        return {
            status: "error",
            query: searchQuery,
            message:
                `Web search failed: ${safeFetchError(error)}`
        };
    }
}


module.exports = {
    webRequest,
    searchWeb,
    htmlToText
};


























