
import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const performOCR = async (imageBase64: string): Promise<OCRResult> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64.split(',')[1] || imageBase64
            }
          },
          {
            text: "Extract clinical data from this prescription. Look for patient details, diagnosis, and medications. Return valid JSON."
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          patientName: { type: Type.STRING },
          age: { type: Type.INTEGER },
          diagnosis: { type: Type.STRING },
          medications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                dosage: { type: Type.STRING },
                frequency: { type: Type.STRING }
              }
            }
          },
          rawText: { type: Type.STRING },
          confidence: { type: Type.NUMBER }
        },
        required: ["patientName", "diagnosis", "medications"]
      }
    }
  });

  return JSON.parse(response.text || '{}') as OCRResult;
};

export const generateSoapNote = async (transcript: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Convert the following clinical transcript into a structured SOAP note (Subjective, Objective, Assessment, Plan):\n\n${transcript}`,
    config: {
      systemInstruction: "You are a professional medical scribe. Your task is to extract relevant clinical information and format it into a standard SOAP note."
    }
  });

  return response.text || "";
};
