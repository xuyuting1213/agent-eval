import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document as LangDocument } from "@langchain/core/documents";
import { prisma } from "~/server/utils/db";

function getEmbeddings() {
  return new OpenAIEmbeddings({
    apiKey: process.env.ZHIPU_API_KEY,
    model: "embedding-2",
    configuration: {
      baseURL: process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
    },
  });
}

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
  separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
});

export async function getVectorStore(knowledgeBaseId: string) {
  const url = process.env.CHROMA_URL || "http://localhost:8000";
  return new Chroma(getEmbeddings(), {
    collectionName: `kb_${knowledgeBaseId}`,
    url,
  });
}

export async function processDocument(
  knowledgeBaseId: string,
  documentId: string,
  text: string,
  fileName: string,
) {
  const chunks = await textSplitter.splitText(text);
  const vectorStore = await getVectorStore(knowledgeBaseId);

  const docs = chunks.map(
    (content, idx) =>
      new LangDocument({
        pageContent: content,
        metadata: { documentId, chunkIndex: idx, fileName, knowledgeBaseId },
      }),
  );
  await vectorStore.addDocuments(docs);

  await prisma.$transaction(
    chunks.map((content, idx) =>
      prisma.chunk.create({
        data: {
          documentId,
          knowledgeBaseId,
          content,
          chunkIndex: idx,
          tokenCount: Math.ceil(content.length / 4),
        },
      }),
    ),
  );

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: "embedded",
      chunkCount: chunks.length,
      embeddedAt: new Date(),
      errorMessage: null,
    },
  });

  return { chunkCount: chunks.length };
}

export async function searchKnowledgeBase(
  knowledgeBaseId: string,
  query: string,
  k = 3,
) {
  const vectorStore = await getVectorStore(knowledgeBaseId);
  const results = await vectorStore.similaritySearch(query, k);
  return results.map((r) => r.pageContent);
}
