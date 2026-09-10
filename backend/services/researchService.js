const {
    OLLAMA_URL,
    OLLAMA_MODEL,
    ULTRON_SYSTEM_PROMPT
} = require("./aiResearchConfig");

/* =========================================================
   ULTRON RESEARCH SERVICE - OPTIMIZED V5

   Goals:
   - Faster Ollama inference
   - Smaller prompt
   - Strong source grounding
   - No incomplete answers
   - Clean structured output
   - Proper source numbering
========================================================= */


/* =========================================================
   HELPERS
========================================================= */

function isOfficialUrl(url = "") {
    const value = String(url).toLowerCase();

    return (
        value.includes("nodejs.org") ||
        value.includes("react.dev") ||
        value.includes("developer.mozilla.org") ||
        value.includes("python.org") ||
        value.includes("typescriptlang.org") ||
        value.includes("github.com") ||
        value.includes(".gov") ||
        value.includes(".edu")
    );
}


function normalizeResearchAnswer(answer, sourceCount = 0) {
    let text = String(answer || "")
        .replace(/\r\n/g, "\n")
        .trim();

    if (!text) {
        return null;
    }

    /* -----------------------------------------------------
       REMOVE THINKING / PROCESS TALK
    ----------------------------------------------------- */

    text = text.replace(
        /^(I will|I'll|I am going to|Let me|I need to|I should|Main check|Main verify|Main search|Mujhe check|Main dekhunga|Main verify karunga)[^\n]*$/gmi,
        ""
    );

    /* -----------------------------------------------------
       NORMALIZE SOURCE REFERENCES

       SOURCE 1 -> [1]
       source 1 -> [1]
    ----------------------------------------------------- */

    text = text.replace(
        /\bSOURCE\s+(\d+)\b/gi,
        "[$1]"
    );

    text = text.replace(
        /\bsource\s*#?\s*(\d+)\b/gi,
        "[$1]"
    );

    /* -----------------------------------------------------
       VALIDATE CITATIONS
    ----------------------------------------------------- */

    const citationPattern = /\[(\d+)\]/g;
    const invalidCitations = [];

    for (const match of text.matchAll(citationPattern)) {
        const number = Number(match[1]);

        if (
            number < 1 ||
            number > sourceCount
        ) {
            invalidCitations.push(number);
        }
    }

    if (invalidCitations.length > 0) {
        console.warn(
            "[RESEARCH CITATION WARNING]",
            {
                sourceCount,
                invalidCitations: [
                    ...new Set(invalidCitations)
                ]
            }
        );
    }

    /* -----------------------------------------------------
       REMOVE INVALID CITATIONS
    ----------------------------------------------------- */

    text = text.replace(
        /\[(\d+)\]/g,
        (match, number) => {
            const n = Number(number);

            if (
                n >= 1 &&
                n <= sourceCount
            ) {
                return `[${n}]`;
            }

            return "";
        }
    );

    /* -----------------------------------------------------
       REMOVE RAW URL LINES
    ----------------------------------------------------- */

    text = text.replace(
        /^\s*\[?\d*\]?\s*https?:\/\/\S+\s*$/gmi,
        ""
    );

    /* -----------------------------------------------------
       REMOVE SOURCES SECTION

       Sources are returned separately by ULTRON.
    ----------------------------------------------------- */

    text = text.replace(
        /^##\s*Sources\b[\s\S]*$/gmi,
        ""
    );

    text = text.replace(
        /^###\s*Sources\b[\s\S]*$/gmi,
        ""
    );

    /* -----------------------------------------------------
       CLEAN MARKDOWN
    ----------------------------------------------------- */

    text = text.replace(
        /\n{3,}/g,
        "\n\n"
    );

    return text.trim() || null;
}


/* =========================================================
   REMOVE HTML / EXTRA CONTENT FROM WEB PAGE
========================================================= */

function cleanPageContent(content) {
    return String(content || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


/* =========================================================
   BUILD COMPACT SOURCE CONTEXT
========================================================= */

function buildResearchContext(pages, query = "") {

    const queryText = String(query || "")
        .toLowerCase();

    const wantsLatest =
        /\b(latest|current|recent|today|this week|this month|as of)\b/
            .test(queryText);

    const wantsOfficial =
        /\b(official|official website|official source|official sources)\b/
            .test(queryText);


    /* -----------------------------------------------------
       SCORE SOURCES
    ----------------------------------------------------- */

    const scoredPages = pages
        .map((page, originalIndex) => {

            const title = String(
                page.title ||
                page.pageTitle ||
                ""
            ).toLowerCase();

            const url = String(
                page.url ||
                ""
            ).toLowerCase();

            const content = String(
                page.readableContent ||
                page.content ||
                ""
            ).toLowerCase();

            let score = 0;


            /* Official domains */

            if (isOfficialUrl(url)) {
                score += 100;
            }


            /* Explicit official request */

            if (wantsOfficial && isOfficialUrl(url)) {
                score += 80;
            }


            /* Latest/current query */

            if (wantsLatest) {

                if (
                    title.includes("latest") ||
                    title.includes("current")
                ) {
                    score += 35;
                }

                if (
                    content.includes("latest") ||
                    content.includes("current")
                ) {
                    score += 15;
                }
            }


            /* Release/download pages */

            if (
                url.includes("/download") ||
                url.includes("/releases") ||
                url.includes("/release/")
            ) {
                score += 20;
            }


            /* Prefer pages containing query terms */

            const queryWords = queryText
                .split(/\s+/)
                .filter(word => word.length > 3)
                .slice(0, 10);

            for (const word of queryWords) {
                if (title.includes(word)) {
                    score += 5;
                }

                if (content.includes(word)) {
                    score += 1;
                }
            }


            /* Date preference */

            const dateText =
                page.modifiedAt ||
                page.publishedAt ||
                "";

            if (dateText) {

                const timestamp =
                    Date.parse(dateText);

                if (!Number.isNaN(timestamp)) {
                    const ageDays =
    Math.max(
        0,
        (Date.now() - timestamp) / 86400000
    );

score += Math.max(
    0,
    30 - Math.min(ageDays, 30)
);
                }
            }


            return {
                page,
                originalIndex,
                score
            };
        })
        .sort((a, b) => {

            if (b.score !== a.score) {
                return b.score - a.score;
            }

            return (
                a.originalIndex -
                b.originalIndex
            );
        });


    /* -----------------------------------------------------
       ONLY 2 SOURCES

       Less context = faster prompt evaluation.
    ----------------------------------------------------- */

    const researchPages = scoredPages
        .slice(0, 2)
        .map(item => item.page);


    console.log(
        "[RESEARCH] Ranked sources:",
        researchPages.map((page, index) => ({
            rank: index + 1,
            title: page.title || "",
            url: page.url || ""
        }))
    );


    /* -----------------------------------------------------
       COMPACT CONTENT

       1400 chars per source instead of 1800.
    ----------------------------------------------------- */

    const context = researchPages
        .map((page, index) => {

            const rawContent =
                page.readableContent ||
                page.content ||
                "";

            const cleanedContent =
                cleanPageContent(rawContent);

            /*
               Extract content relevant to the research query.
               Prefer matches around important query keywords,
               otherwise fall back to the beginning of the page.
            */

            const queryTerms =
                String(query || "")
                    .toLowerCase()
                    .split(/\s+/)
                    .map(word =>
                        word.replace(/[^a-z0-9.:-]/g, "")
                    )
                    .filter(word => word.length >= 4)
                    .filter(word =>
                        ![
                            "from",
                            "sources",
                            "source",
                            "with",
                            "give",
                            "latest",
                            "current",
                            "recent",
                            "concise",
                            "answer",
                            "research",
                            "using",
                            "official"
                        ].includes(word)
                    )
                    .slice(0, 8);

            let content = "";

            const lowerContent =
                cleanedContent.toLowerCase();

            for (const term of queryTerms) {
                const index =
                    lowerContent.indexOf(term);

                if (index !== -1) {
                    const start =
                        Math.max(0, index - 250);

                    const end =
                        Math.min(
                            cleanedContent.length,
                            index + 650
                        );

                    content =
                        cleanedContent.slice(start, end);

                    break;
                }
            }

            if (!content) {
                content =
                    cleanedContent.slice(0, 900);
            }

            content =
                content.slice(0, 1400);


            return [
                `SOURCE ${index + 1}`,
                `Title: ${page.title || "Unknown"}`,
                `URL: ${page.url || "Unknown"}`,
                `Published: ${page.publishedAt || "Unknown"}`,
                `Modified: ${page.modifiedAt || "Unknown"}`,
                `Content: ${content}`
            ].join("\n");
        })
        .join("\n\n");


    return {
        context,
        researchPages
    };
}


/* =========================================================
   MAIN RESEARCH FUNCTION
========================================================= */

async function summarizeWebResearch(query, pages) {

    const perfStart = Date.now();


    /* -----------------------------------------------------
       VALIDATE PAGES
    ----------------------------------------------------- */

    const usablePages = Array.isArray(pages)
        ? pages.filter(page => {

            if (!page) {
                return false;
            }

            const content =
                page.readableContent ||
                page.content ||
                "";

            return (
                String(content).trim().length > 0
            );
        })
        : [];


    if (usablePages.length === 0) {

        return {
            status: "error",
            intent: "web_research",
            query,
            message:
                "Research ke liye readable webpage content nahi mila."
        };
    }


    console.log(
        `[RESEARCH] Usable sources: ${usablePages.length}`
    );


    /* -----------------------------------------------------
       BUILD CONTEXT
    ----------------------------------------------------- */

    const contextStart = Date.now();

    const {
        context: researchContext,
        researchPages
    } = buildResearchContext(
        usablePages,
        query
    );


    console.log(
        `[RESEARCH PERF] Context build: ${
            Date.now() - contextStart
        } ms`
    );

    console.log(
        `[RESEARCH PERF] Sources sent to AI: ${
            researchPages.length
        }`
    );

    console.log(
        `[RESEARCH PERF] Context size: ${
            researchContext.length
        } chars`
    );


    /* -----------------------------------------------------
       SHORT SYSTEM PROMPT
    ----------------------------------------------------- */

    const systemPrompt = `
You are ULTRON's web research summarizer.

Use ONLY the supplied web sources.

Rules:
- Do not use outside knowledge.
- Never guess or assume a fact.
- If the exact requested fact is not present in the supplied sources, explicitly say it is not confirmed.
- Prefer official sources over third-party sources.
- Prefer newer dated information when the query asks for latest/current information.
- For version, release, price, date, or number questions, use the exact value stated in the source.
- If sources disagree, report the disagreement instead of choosing a value by guesswork.
- Every factual claim must end with a valid citation such as [1] or [2].
- Every bullet containing a factual claim MUST have its citation at the END of that bullet.
- The conclusion MUST also contain citations for its factual claims.
- Never leave a factual bullet or factual conclusion without a citation.
- Only use source numbers that actually exist.
- Never write "SOURCE 1"; write [1].
- Do not describe your research process.
- Do not say you will search, check, verify, or research.
- Do not create a Sources section.
- Use Roman Hinglish when appropriate.
- Never use Devanagari.
- Keep the answer concise.
- Finish every section completely.

Output exactly:

## Summary
- Maximum 2 short bullets.

## Key Findings
- Maximum 2 short bullets.

## Conclusion
One short complete conclusion.

Return ONLY the final report.
`.trim();


    /* -----------------------------------------------------
       BUILD MESSAGES
    ----------------------------------------------------- */

    const messages = [
        {
            role: "system",
            content: systemPrompt
        },
        {
            role: "user",
            content: `
Research query:
${query}

Supplied web sources:

${researchContext}

Return the final concise report.
`.trim()
        }
    ];


    /* -----------------------------------------------------
       OLLAMA PAYLOAD

       num_predict 140:
       Enough for complete report,
       but prevents unnecessary long generation.
    ----------------------------------------------------- */

    const payload = {
        model: OLLAMA_MODEL,

        messages,

        stream: false,

        think: false,

        keep_alive: "10m",

        options: {
            temperature: 0.05,
            top_p: 0.7,
            num_predict: 180
        }
    };


    const payloadString =
        JSON.stringify(payload);


    console.log(
        `[RESEARCH PERF] Payload size: ${
            payloadString.length
        } chars`
    );

    console.log(
        `[RESEARCH PERF] Preparation total: ${
            ((Date.now() - perfStart) / 1000)
                .toFixed(2)
        } sec`
    );


    /* -----------------------------------------------------
       OLLAMA REQUEST
    ----------------------------------------------------- */

    const ollamaStart = Date.now();

    try {

        const response = await fetch(
            OLLAMA_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: payloadString
            }
        );


        const ollamaSeconds =
            (Date.now() - ollamaStart) / 1000;


        console.log(
            `[RESEARCH PERF] Ollama fetch: ${
                ollamaSeconds.toFixed(2)
            } sec`
        );


        if (!response.ok) {

            throw new Error(
                `Ollama research summarizer failed: ${response.status}`
            );
        }


        /* -------------------------------------------------
           PARSE RESPONSE
        ------------------------------------------------- */

        const data =
            await response.json();


        console.log(
            "[OLLAMA METRICS]",
            {
                load_duration:
                    data?.load_duration,

                prompt_eval_duration:
                    data?.prompt_eval_duration,

                eval_duration:
                    data?.eval_duration,

                prompt_eval_count:
                    data?.prompt_eval_count,

                eval_count:
                    data?.eval_count,

                done_reason:
                    data?.done_reason
            }
        );


        /* -------------------------------------------------
           DETECT INCOMPLETE RESPONSE
        ------------------------------------------------- */

        const incomplete =
            data?.done_reason === "length";


        if (incomplete) {

            console.warn(
                "[RESEARCH] AI answer reached output limit."
            );

            console.warn(
                "[RESEARCH] Done reason:",
                data?.done_reason
            );

            return {
                status: "error",
                intent: "web_research",
                query,
                incomplete: true,
                message:
                    "Research summary complete nahi ho paayi kyunki AI output limit tak pahunch gaya."
            };
        }


        /* -------------------------------------------------
           NORMALIZE ANSWER
        ------------------------------------------------- */

        let answer =
            normalizeResearchAnswer(
                data?.message?.content,
                researchPages.length
            );


        if (!answer) {

            return {
                status: "error",
                intent: "web_research",
                query,
                message:
                    "Research complete hui, lekin AI summary generate nahi ho paayi."
            };
        }


        /* -------------------------------------------------
           ALLOWED SECTIONS
        ------------------------------------------------- */

        const allowedSections =
            new Set([
                "Summary",
                "Key Findings",
                "Conclusion"
            ]);


        answer = answer.replace(
            /^##\s+(.+)$/gm,
            (fullMatch, heading) => {

                const cleanHeading =
                    String(heading).trim();


                if (
                    allowedSections.has(
                        cleanHeading
                    )
                ) {
                    return `## ${cleanHeading}`;
                }


                console.warn(
                    `[RESEARCH] Removed unsupported section: ${cleanHeading}`
                );


                return "";
            }
        );


        answer = answer
            .replace(/\n{3,}/g, "\n\n")
            .trim();


        /* -------------------------------------------------
           ENSURE SUMMARY
        ------------------------------------------------- */

        if (
            !/^## Summary\b/im.test(answer)
        ) {

            answer =
                `## Summary\n- Research result supplied sources ke basis par diya gaya hai.\n\n${answer}`;
        }


        /* -------------------------------------------------
           ENSURE KEY FINDINGS
        ------------------------------------------------- */

        if (
            !/^## Key Findings\b/im.test(answer)
        ) {

            answer +=
                "\n\n## Key Findings\n- Supplied web sources ke basis par findings summarize ki gayi hain.";
        }


        /* -------------------------------------------------
           ENSURE CONCLUSION
        ------------------------------------------------- */

        if (
            !/^## Conclusion\b/im.test(answer)
        ) {

            answer +=
                "\n\n## Conclusion\nSupplied web sources ke basis par ye research result tayyar kiya gaya hai.";
        }


        /* -------------------------------------------------
           FINAL CLEANUP
        ------------------------------------------------- */

        answer = answer
            .replace(/\n{3,}/g, "\n\n")
            .trim();


        /* -------------------------------------------------
           CITATION VALIDATION
        ------------------------------------------------- */

        const sourceCount =
            Array.isArray(researchPages)
                ? researchPages.length
                : 0;

        const citationPattern =
            /\[(\d+)\]/g;

        const invalidCitations = [];

        answer = answer.replace(
            citationPattern,
            (fullMatch, number) => {

                const citationNumber =
                    Number(number);

                if (
                    citationNumber >= 1 &&
                    citationNumber <= sourceCount
                ) {
                    return fullMatch;
                }

                invalidCitations.push(
                    citationNumber
                );

                return "";
            }
        );

        if (invalidCitations.length > 0) {

            console.warn(
                "[RESEARCH] Invalid citations removed:",
                invalidCitations
            );
        }

        const uncitedFactualLines =
            answer
                .split("\n")
                .filter(line =>
                    /^\s*-\s+/.test(line) ||
                    /^\s*[^#\n].+/.test(line)
                )
                .filter(line =>
                    !/^##\s+/.test(line)
                )
                .filter(line =>
                    !/\[\d+\]\s*$/.test(line.trim())
                );

        if (uncitedFactualLines.length > 0) {

            console.warn(
                "[RESEARCH] Uncited factual lines detected:",
                uncitedFactualLines.length
            );
        }
        /* -------------------------------------------------
           FINAL PERFORMANCE
        ------------------------------------------------- */

        const totalSeconds =
            (Date.now() - perfStart) / 1000;


        console.log(
            `[RESEARCH PERF] TOTAL: ${
                totalSeconds.toFixed(2)
            } sec`
        );


        /* -------------------------------------------------
           RETURN RESULT
        ------------------------------------------------- */

        return {

            status: "success",

            intent: "web_research",

            source: "web+ai",

            query,

            researchFormat:
                "structured-markdown",

            answer,

            incomplete,

            sources:
                researchPages.map(page => ({

                    title:
                        page.title || "",

                    url:
                        page.url || "",

                    publishedAt:
                        page.publishedAt || "",

                    modifiedAt:
                        page.modifiedAt || ""
                })),

            message: answer
        };


    } catch (error) {

        console.error(
            "[ULTRON RESEARCH AI ERROR]",
            {
                name: error.name,
                message: error.message
            }
        );


        return {

            status: "error",

            intent: "web_research",

            query,

            message:
                "Research AI se response generate nahi ho paaya."
        };
    }
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
    summarizeWebResearch
};
















