/* =========================================================
   ULTRON MEMORY SERVICE
========================================================= */

const fs = require("fs");
const path = require("path");

const memoryFile = path.join(
    __dirname,
    "..",
    "data",
    "memory.json"
);


/* =========================================================
   READ MEMORY FILE
========================================================= */

function readMemoryFile() {

    try {

        if (!fs.existsSync(memoryFile)) {
            return [];
        }

        const data =
            fs.readFileSync(
                memoryFile,
                "utf-8"
            );

        if (!data.trim()) {
            return [];
        }

        const parsed =
            JSON.parse(data);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.error(
            "ULTRON memory read error:",
            error
        );

        return [];
    }
}


/* =========================================================
   WRITE MEMORY FILE
========================================================= */

function writeMemoryFile(memories) {

    const memoryDirectory =
        path.dirname(memoryFile);

    if (!fs.existsSync(memoryDirectory)) {

        fs.mkdirSync(
            memoryDirectory,
            {
                recursive: true
            }
        );
    }

    fs.writeFileSync(
        memoryFile,
        JSON.stringify(
            memories,
            null,
            2
        ),
        "utf-8"
    );
}


/* =========================================================
   NORMALIZE MEMORY
========================================================= */

function normalizeMemoryText(value) {

    return String(
        value || ""
    )
        .trim()
        .replace(/\s+/g, " ");
}


/* =========================================================
   NORMALIZE SEARCH QUERY
========================================================= */

function normalizeSearchQuery(value) {

    return normalizeMemoryText(value)
        .toLowerCase()
        .replace(/[.!?,;:]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


/* =========================================================
   TOKENIZE SEARCH QUERY
========================================================= */

function tokenize(value) {

    return normalizeSearchQuery(value)
        .split(/\s+/)
        .filter(Boolean);
}


/* =========================================================
   STOP WORDS
========================================================= */

const SEARCH_STOP_WORDS = new Set([
    "the",
    "a",
    "an",
    "my",
    "me",
    "is",
    "are",
    "was",
    "were",
    "be",
    "to",
    "from",
    "into",
    "with",
    "for",
    "of",
    "and",
    "or",
    "that",
    "this",
    "these",
    "those",
    "please",
    "can",
    "you",
    "could",
    "would",
    "should",
    "about",
    "meri",
    "mera",
    "mujhe",
    "hai",
    "tha",
    "thi",
    "se",
    "ko",
    "ka",
    "ki",
    "ke",
    "aur",
    "ye",
    "woh",
    "wali",
    "wala",
    "memory",
    "preference"
]);


/* =========================================================
   MEANINGFUL TOKENS
========================================================= */

function meaningfulTokens(value) {

    return tokenize(value)
        .filter(
            token =>
                token.length >= 2 &&
                !SEARCH_STOP_WORDS.has(token)
        );
}


/* =========================================================
   CHECK DUPLICATE MEMORY
========================================================= */

function memoryAlreadyExists(
    memories,
    type,
    content
) {

    const normalizedType =
        normalizeMemoryText(
            type
        ).toLowerCase();

    const normalizedContent =
        normalizeMemoryText(
            content
        ).toLowerCase();


    return memories.some(memory => {

        const memoryType =
            normalizeMemoryText(
                memory.type
            ).toLowerCase();

        const memoryContent =
            normalizeMemoryText(
                memory.content
            ).toLowerCase();

        return (
            memoryType === normalizedType &&
            memoryContent === normalizedContent
        );
    });
}


/* =========================================================
   SAVE MEMORY
========================================================= */


function getPreferenceKey(content) {
    const text = normalizeMemoryText(content);

    if (/favorite\s+(?:editor|ide)/i.test(text)) {
        return "favorite_editor";
    }

    if (/favorite\s+(?:programming\s+)?language/i.test(text)) {
        return "favorite_programming_language";
    }

    if (/favorite\s+(?:color|colour)/i.test(text)) {
        return "favorite_color";
    }

    if (/(?:my|mera|user\s+ka)\s+name/i.test(text)) {
        return "user_name";
    }

    return null;
}

function saveMemory(
    type,
    content
) {

    const cleanType =
        normalizeMemoryText(type);

    const cleanContent =
        normalizeMemoryText(content);


    if (
        !cleanType ||
        !cleanContent
    ) {

        throw new Error(
            "Memory type and content are required."
        );
    }


    const memories =
        readMemoryFile();


    if (
        memoryAlreadyExists(
            memories,
            cleanType,
            cleanContent
        )
    ) {

        return {
            status: "existing",
            message:
                "Memory already exists."
        };
    }


    const now =
        new Date().toISOString();


    
    const preferenceKey =
        getPreferenceKey(cleanContent);

    if (preferenceKey) {
        const existingIndex =
            memories.findIndex(
                memory =>
                    getPreferenceKey(
                        memory.content
                    ) === preferenceKey
            );

        if (existingIndex !== -1) {
            const existing =
                memories[existingIndex];

            existing.content =
                cleanContent;

            existing.updatedAt =
                new Date().toISOString();

            writeMemoryFile(memories);

            return {
                status: "updated",
                memory: existing
            };
        }
    }

const memory = {

        id:
            Date.now(),

        type:
            cleanType,

        content:
            cleanContent,

        createdAt:
            now,

        updatedAt:
            now
    };


    memories.push(
        memory
    );


    const limitedMemories =
        memories.slice(-100);


    writeMemoryFile(
        limitedMemories
    );


    return memory;
}


/* =========================================================
   GET ALL MEMORIES
========================================================= */

function getMemories() {

    return readMemoryFile();
}


/* =========================================================
   GET RECENT MEMORIES
========================================================= */

function getRecentMemories(
    limit = 10
) {

    const memories =
        readMemoryFile();


    const safeLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) || 10,
                50
            )
        );


    return memories
        .slice(-safeLimit)
        .reverse();
}


/* =========================================================
   SCORE MEMORY MATCH
========================================================= */

function scoreMemory(
    memory,
    query
) {

    const memoryType =
        normalizeSearchQuery(
            memory?.type
        );

    const memoryContent =
        normalizeSearchQuery(
            memory?.content
        );

    const fullMemory =
        `${memoryType} ${memoryContent}`.trim();


    const cleanQuery =
        normalizeSearchQuery(
            query
        );


    if (
        !cleanQuery ||
        !fullMemory
    ) {
        return 0;
    }


    let score = 0;


    /* -----------------------------------------------------
       Exact full phrase
    ----------------------------------------------------- */

    if (
        memoryContent === cleanQuery
    ) {
        score += 100;
    }


    /* -----------------------------------------------------
       Query contained in memory
    ----------------------------------------------------- */

    if (
        memoryContent.includes(
            cleanQuery
        )
    ) {
        score += 60;
    }


    /* -----------------------------------------------------
       Memory contained in query
    ----------------------------------------------------- */

    if (
        cleanQuery.includes(
            memoryContent
        )
    ) {
        score += 45;
    }


    /* -----------------------------------------------------
       Token based matching
    ----------------------------------------------------- */

    const queryTokens =
        meaningfulTokens(
            cleanQuery
        );


    const memoryTokens =
        new Set(
            meaningfulTokens(
                fullMemory
            )
        );


    let matchedTokens = 0;


    for (
        const token of queryTokens
    ) {

        if (
            memoryTokens.has(token)
        ) {

            matchedTokens++;

            score += 12;
        }
    }


    /* -----------------------------------------------------
       Strong phrase matching
       Example:
       "favorite editor from Cursor"
       should still identify:
       "my favorite editor is Cursor"
    ----------------------------------------------------- */

    if (
        queryTokens.length > 0 &&
        matchedTokens === queryTokens.length
    ) {

        score += 50;
    }


    /* -----------------------------------------------------
       Partial token matching
    ----------------------------------------------------- */

    for (
        const queryToken of queryTokens
    ) {

        if (
            queryToken.length < 3
        ) {
            continue;
        }


        for (
            const memoryToken of memoryTokens
        ) {

            if (
                memoryToken.startsWith(
                    queryToken
                ) ||
                queryToken.startsWith(
                    memoryToken
                )
            ) {

                score += 4;
                break;
            }
        }
    }


    return score;
}


/* =========================================================
   SEARCH MEMORIES
========================================================= */

function searchMemories(
    query,
    limit = 10
) {

    const cleanQuery =
        normalizeSearchQuery(
            query
        );


    if (!cleanQuery) {
        return [];
    }


    const memories =
        readMemoryFile();


    const safeLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) || 10,
                50
            )
        );


    return memories
        .map(
            (
                memory,
                index
            ) => ({

                memory,

                score:
                    scoreMemory(
                        memory,
                        cleanQuery
                    ),

                index
            })
        )
        .filter(
            item =>
                item.score > 0
        )
        .sort(
            (
                a,
                b
            ) => {

                if (
                    b.score !==
                    a.score
                ) {

                    return (
                        b.score -
                        a.score
                    );
                }

                return (
                    b.index -
                    a.index
                );
            }
        )
        .slice(
            0,
            safeLimit
        )
        .map(
            item =>
                item.memory
        );
}


/* =========================================================
   FIND MEMORY
========================================================= */

function findMemory(
    query
) {

    const results =
        searchMemories(
            query,
            1
        );


    return results.length > 0
        ? results[0]
        : null;
}


/* =========================================================
   UPDATE MEMORY
========================================================= */

function updateMemory(
    id,
    type,
    content
) {

    const memories =
        readMemoryFile();


    const memoryIndex =
        memories.findIndex(
            memory =>
                Number(memory.id) ===
                Number(id)
        );


    if (
        memoryIndex === -1
    ) {

        return {
            status: "error",
            message:
                "Memory not found."
        };
    }


    const currentMemory =
        memories[memoryIndex];


    const updatedType =
        type !== undefined
            ? normalizeMemoryText(
                type
            )
            : currentMemory.type;


    const updatedContent =
        content !== undefined
            ? normalizeMemoryText(
                content
            )
            : currentMemory.content;


    if (
        !updatedType ||
        !updatedContent
    ) {

        return {
            status: "error",
            message:
                "Memory type and content cannot be empty."
        };
    }


    memories[memoryIndex] = {

        ...currentMemory,

        type:
            updatedType,

        content:
            updatedContent,

        updatedAt:
            new Date().toISOString()
    };


    writeMemoryFile(
        memories
    );


    return {

        status: "success",

        message:
            "Memory updated.",

        memory:
            memories[memoryIndex]
    };
}


/* =========================================================
   UPDATE MEMORY BY SEARCH
========================================================= */

function updateMemoryByQuery(
    query,
    type,
    content
) {

    const memory =
        findMemory(
            query
        );


    if (!memory) {

        return {

            status: "error",

            message:
                "No matching memory found."
        };
    }


    return updateMemory(
        memory.id,
        type,
        content
    );
}


/* =========================================================
   DELETE MEMORY BY ID
========================================================= */

function deleteMemory(
    id
) {

    const memories =
        readMemoryFile();


    const memoryIndex =
        memories.findIndex(
            memory =>
                Number(memory.id) ===
                Number(id)
        );


    if (
        memoryIndex === -1
    ) {

        return {

            status: "error",

            message:
                "Memory not found."
        };
    }


    const deletedMemory =
        memories[memoryIndex];


    memories.splice(
        memoryIndex,
        1
    );


    writeMemoryFile(
        memories
    );


    return {

        status: "success",

        message:
            "Memory deleted.",

        memory:
            deletedMemory
    };
}


/* =========================================================
   DELETE MEMORY BY SEARCH
========================================================= */

function deleteMemoryByQuery(
    query
) {

    const memory =
        findMemory(
            query
        );


    if (!memory) {

        return {

            status: "error",

            message:
                "No matching memory found."
        };
    }


    return deleteMemory(
        memory.id
    );
}


/* =========================================================
   BUILD MEMORY CONTEXT
========================================================= */

function buildMemoryContext(
    limit = 8
) {

    const memories =
        getRecentMemories(
            limit
        );


    if (
        memories.length === 0
    ) {

        return "No saved memories available.";
    }


    return memories
        .map(
            memory => {

                return (
                    `[${memory.type}] ` +
                    `${memory.content}`
                );

            }
        )
        .join("\n");
}


/* =========================================================
   CLEAR ALL MEMORIES
========================================================= */

function clearMemories() {

    writeMemoryFile(
        []
    );


    return {

        status: "success",

        message:
            "ULTRON memory cleared."
    };
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {

    saveMemory,

    getMemories,

    getRecentMemories,

    searchMemories,

    findMemory,

    updateMemory,

    updateMemoryByQuery,

    deleteMemory,

    deleteMemoryByQuery,

    buildMemoryContext,

    clearMemories
};