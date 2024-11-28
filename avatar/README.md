# Interactive Avatar for DS 266 Final Project

## Getting Started

### Setting up the site

1. Run `npm install` (assuming you have npm installed. If not, please follow these instructions: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/)

2. Make sure all API Keys are present in the `.env` file.

3. Run `npm run dev`

4. Run the following command to initialize the model implementation API. Make sure to navigate to the LLM/src folder!

   `uvicorn model:app --reload --host 0.0.0.0 --port 8000`