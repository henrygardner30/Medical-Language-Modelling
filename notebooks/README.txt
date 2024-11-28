This folder contains notebook files and results of all models. I split up this project by starting with these notebooks to get a full representation of what is happening with clear outputs.
In the avatar/ folder you will find non-notebook python code needed for the API to interact with the avatar and the model.

NOTE: I rearraned some of the result, log, and data files into their own respective folders for ease of access and understanding. In some of the file writing steps, I just wrote it to the 
current directory, but then manually moved it later. Just referencing this in case of confusion.

FILES:
    - setup.ipynb -> this is the setup file to convert the data and do some basic analysis into what we are working with
    - BERT.ipynb -> this is the retrival step in the RAG model, it is the out-of-the-box BERT model that uses cosine similarity to retrive similar conversations
    - gpt_2.ipynb -> this is the notebook detailing the generative model GPT-2 both baseline and fine-tuning versions
    - llama.ipynb -> this is the notebook detailing the generative model LLAMA both baseline and fine-tuning versions
    - openai.ipynb -> this notebook is all the pay-for version of OpenAI's LLMs. I fine-tuned one that costed roughly $27
    - evaluation.ipynb -> this is the evaluation file to determine the success of a model
    - ensemble.ipynb -> this is the ensemble model file to combine BERT and GPT-3.5 Turbo.
