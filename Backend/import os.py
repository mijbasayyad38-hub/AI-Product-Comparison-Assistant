import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY is missing from .env")
llm=ChatGoogleGenerativeAI(
    model="gemini-3.5-flash-lite",
    google_api_key=api_key
)

prompt=ChatPromptTemplate.from_template(
    """
You are a helpful AI assistant. Answer the following question in the JSON format only:
{question}
"""
)
chain=prompt | llm
question="explain me Langchain, RAG and LLM with the reference links"
response=chain.invoke({"question":question})
print("\nAI Response:")
print(response.content)