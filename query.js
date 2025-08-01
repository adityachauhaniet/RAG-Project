import * as dotenv from 'dotenv';
dotenv.config();

import readlineSync from 'readline-sync';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenAI } from "@google/genai";

// Set up the Google GenAI client(configured the google gemini model)
const ai = new GoogleGenAI({});
const History = [] // it tell chats about user and ai model

// a new function to represeent to question in new context in depth
async function transformQuery(question){

History.push({
    role:'user',
    parts:[{text:question}]
    })  

const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: History,
    config: {
      systemInstruction: `You are a query rewriting expert. Based on the provided chat history, rephrase the "Follow Up user Question" into a complete, standalone question that can be understood without the chat history.
    Only output the rewritten question and nothing else.
      `,
    },
 });
 
 History.pop()
 
 return response.text


}




async function chatting(question){

    //convert this question into vector

    const queries = await transformQuery(question); // question ka real meaning vector form me convert karega


    const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'text-embedding-004',
    });
 
 const queryVector = await embeddings.embedQuery(question);   
 // till now w'll get vector query, now we serch in pinecone

 //make connection with pinecone
 const pinecone = new Pinecone();
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);
// till now connection w'll be build
// now we search item in pinecone

const searchResults = await pineconeIndex.query({
    topK: 10, // we searching top 10 relevent item
    vector: queryVector,
    includeMetadata: true,
    });
    // till now we get search result, now we get answer from result
   // console.log(searchResults);
    // till now we get search result, now we get answer from result

    //top 10 documents : 10 metadata text part 10 document
    //we extracting the text from all 10 decuments and combined them
    const context = searchResults.matches
                   .map(match => match.metadata.text)
                   .join("\n\n---\n\n");
    // till now we get context, now we get answer from context by giving it to LLM model

    // gemini
    // jo bhi question ayega use history me push karenge
    History.push({
    role:'user',
    parts:[{text:queries}]
    })  

    // now generate the ai model
    const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: History,
    config: {
      systemInstruction: `You have to behave like a Data Structure and Algorithm Expert.
    You will be given a context of relevant information and a user question.
    Your task is to answer the user's question based ONLY on the provided context.
    If the answer is not in the context, you must say "I could not find the answer in the provided document."
    Keep your answers clear, concise, and educational.
      
      Context: ${context}
      `,
    },
   });

   // push the response of model in history
   History.push({
    role:'model',
    parts:[{text:response.text}]
  })

  console.log("\n");
  // printing the response
  console.log(response.text);


}


async function main(){
   const userProblem = readlineSync.question("Ask me anything--> ");
   await chatting(userProblem);
   main();
}


main();