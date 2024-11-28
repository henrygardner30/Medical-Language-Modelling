"""
This file implements a FastAPI connection to the Medical Chat-GPT Model.

Henry Gardner
MIDS DS266 Final Project
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
from dotenv import load_dotenv
from openai import OpenAI


# initialize the backend
app = FastAPI()

# Add CORS middleware
# Adjust this to be more restrictive in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RequestModel(BaseModel):
    input_text: str

# have the routed link to get the RAG model output
@app.post('/api/get-model-output')
def get_model_output(request: RequestModel):
    try:
        #load in the environment varaibles to get the API key
        load_dotenv()
        OPENAI_API_KEY = os.getenv("API_KEY")

        # first connect with the API_KEY we just generated
        client = OpenAI(api_key=OPENAI_API_KEY)

        # craft context for fine-tuned model
        system_message = "You are a medical expert helping patients talk through their concerns."
        user_message = f"""
                Attached is a user input medical question, come up with an accurate answer to the user's query. 
                Only return the answer and make sure the information is accurate.
                Keep the answer brief, only to about 2 sentences.

                Question: {request.input_text}
        """
        # now get fine-tuned response
        fine_tune_completion = client.chat.completions.create(
            model="ft:gpt-3.5-turbo-0125:personal::AWJTxERx",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ]
        )
        return fine_tune_completion.choices[0].message.content
    except Exception as e:
        return "Error fetching model response..."
    
# initialize the api and run it locally
if __name__ == '__main__':
    # start the api locally!
    uvicorn.run(app, host='0.0.0.0', port=8000)