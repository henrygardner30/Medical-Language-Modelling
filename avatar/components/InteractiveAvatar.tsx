import { AVATARS, VOICES } from "@/app/lib/constants";

export enum NewSessionRequestVoiceEmotionEnum {
  Excited = "Excited",
  Serious = "Serious",
  Friendly = "Friendly",
  Soothing = "Soothing",
  Broadcaster = "Broadcaster",
}

import {
  Configuration,
  NewSessionData,
  StreamingAvatarApi,
} from "@heygen/streaming-avatar";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Divider,
  Input,
  Select,
  SelectItem,
  Spinner,
  Tooltip,
} from "@nextui-org/react";
import { Microphone, MicrophoneStage } from "@phosphor-icons/react";
import { useChat } from "ai/react";
import clsx from "clsx";
import OpenAI from "openai";
import { useEffect, MutableRefObject, useRef, useState } from "react";
import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";
import { start } from "repl";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export default function InteractiveAvatar() {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>();
  const [avatarId, setAvatarId] = useState<string>("");
  const [voiceId, setVoiceId] = useState<string>("");
  const [RATE, setRate] = useState<number>(1.0);
  const [EMOTION, setEmotion] = useState<string>("");
  const [avatarTalking, setAvatarTalking] = useState(false); // Track avatar talking state
  const [data, setData] = useState<NewSessionData>();
  const [text, setText] = useState<string>("");
  const [initialized, setInitialized] = useState(false); // Track initialization
  // used for the model implementation retrieval
  const [MODELOUTPUT, setMODELOUTPUT] = useState<string>("");
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatarApi | null>(null);
  // for the mic auto capture recording!
  const [recording, setRecording] = useState(false); // Track recording state
  const [transcription, setTranscription] = useState<string>("");
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const pauseDetectionTimer: MutableRefObject<NodeJS.Timeout | null> = useRef(null);  

  const { input, setInput, handleSubmit } = useChat({
    onFinish: async (message) => {
      console.log("ChatGPT Response:", message);

      if (!initialized || !avatar.current) {
        setDebug("Avatar API not initialized");
        return;
      }

      // send the ChatGPT response to the Interactive Avatar
      await avatar.current
        .speak({
          taskRequest: { text: message.content, sessionId: data?.sessionId },
        })
        .catch((e) => {
          setDebug(e.message);
        });
      setIsLoadingChat(false);
    },
    initialMessages: [
      {
        id: "1",
        role: "system",
        content: "You are a helpful assistant.",
      },
    ],
  });

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();
      console.log("Access Token:", token); // Log the token to verify
      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
      return "";
    }
  }

  async function startSession() {
    setIsLoadingSession(true);
    await updateToken();
    if (!avatar.current) {
      setDebug("Avatar API is not initialized");
      return;
    }
    try {
      const res = await avatar.current.createStartAvatar(
        {
          newSessionRequest: {
            quality: "low",
            avatarName: avatarId,
            voice: {
              voiceId: voiceId,
              rate: RATE,
              emotion: EMOTION as NewSessionRequestVoiceEmotionEnum, // Pass the emotion
            }
          },
        },
        setDebug
      );
      setData(res);
      setStream(avatar.current.mediaStream);
    } catch (error) {
      console.error("Error starting avatar session:", error);
      setDebug(
        `There was an error starting the session. ${voiceId ? "This custom voice ID may not be supported." : ""}`
      );
    }
    setIsLoadingSession(false);
  }

  async function updateToken() {
    const newToken = await fetchAccessToken();
    console.log("Updating Access Token:", newToken); // Log token for debugging
    avatar.current = new StreamingAvatarApi(
      new Configuration({ accessToken: newToken })
    );

    const startTalkCallback = (e: any) => {
      console.log("Avatar started talking", e);
      setAvatarTalking(true);
    };

    const stopTalkCallback = (e: any) => {
      console.log("Avatar stopped talking", e);
      setAvatarTalking(false);
    };

    console.log("Adding event handlers:", avatar.current);
    avatar.current.addEventHandler("avatar_start_talking", startTalkCallback);
    avatar.current.addEventHandler("avatar_stop_talking", stopTalkCallback);

    setInitialized(true);
  }

  async function handleInterrupt() {
    if (!initialized || !avatar.current) {
      setDebug("Avatar API not initialized");
      return;
    }
    await avatar.current
      .interrupt({ interruptRequest: { sessionId: data?.sessionId } })
      .catch((e) => {
        setDebug(e.message);
      });
  }

  async function endSession() {
    if (!initialized || !avatar.current) {
      setDebug("Avatar API not initialized");
      return;
    }
    await avatar.current.stopAvatar(
      { stopSessionRequest: { sessionId: data?.sessionId } },
      setDebug
    );
    setStream(undefined);
  }

  async function handleSpeak() {
    setIsLoadingRepeat(true);
    
    if (!initialized || !avatar.current) {
      setDebug("Avatar API not initialized");
      setIsLoadingRepeat(false);
      return;
    }
    
    try {
      const output = await fetchModelOutput(text);
      
      if (!output.trim()) {
        setDebug("No output received from the model.");
        setIsLoadingRepeat(false);
        return "";
      }
      
      await avatar.current.speak({
        taskRequest: { text: output, sessionId: data?.sessionId },
      });
      
    } catch (e: any) {
      setDebug(e.message);
    } finally {
      setIsLoadingRepeat(false);
    }
  }

  // model implementation function to grab the output from the backend Python file!
  async function fetchModelOutput(inputText: string) {
    const url = "http://localhost:8000/api/get-model-output";
    const headers = {
      "Content-Type": "application/json",
    };
  
    const body = JSON.stringify({ input_text: inputText });
  
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      const data = await response.json();
      console.log("Model Output:", data);
      // update the MODELOUTPUT variable
      setMODELOUTPUT(data);
      return data;
    } catch (error) {
      console.error("Error fetching model output:", error);
      throw error;
    }
  }

  useEffect(() => {
    async function init() {
      const newToken = await fetchAccessToken();
      console.log("Initializing with Access Token:", newToken); // Log token for debugging
      avatar.current = new StreamingAvatarApi(
        new Configuration({ accessToken: newToken, jitterBuffer: 200 })
      );
      setInitialized(true); // Set initialized to true
    }
    init();

    return () => {
      endSession();
    };
  }, []);

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
        setDebug("Playing");
      };
    }
  }, [mediaStream, stream]);

  function startRecording() {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        mediaRecorder.current = new MediaRecorder(stream);
        mediaRecorder.current.ondataavailable = (event) => {
          audioChunks.current.push(event.data);
        };
        mediaRecorder.current.onstop = () => {
          const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
          audioChunks.current = [];
          transcribeAndSpeak(audioBlob);
        };
        mediaRecorder.current.start();
        console.log("Recording started");
        setRecording(true);

        // stop recording after a specified time
        /*
        setTimeout(() => {
          console.log("Maximum recording time reached. Stopping recording.");
          stopRecording();
        }, 10000);
        */
      })
      .catch((error) => {
        console.error("Error accessing microphone:", error);
        alert("Error accessing microphone. Please check your microphone settings and permissions.");
      });
  }

  async function transcribeAndSpeak(audioBlob: Blob) {
    try {
      const audioFile = new File([audioBlob], "recording.wav", { type: "audio/wav" });
      console.log("Transcribing audio:", audioFile);
      const response = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: audioFile,
      });
      const transcription = (response.text || "").trim();
      console.log("Transcription: ", transcription);
      setTranscription(transcription);
  
      // Check if the user said "done"
      if (transcription.toLowerCase().includes("done")) {
        console.log("User said 'done'. Stopping recording.");
        stopRecording();
        return;
      }
  
      if (transcription) {
        const output = await fetchModelOutput(transcription);
        handleSpeakOutput(output);
      }
    } catch (error) {
      console.error("Error transcribing audio:", error);
    }
  }
  
  function stopRecording() {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setRecording(false);
    }
  }
  
async function handleSpeakOutput(output: string) {
  if (!initialized || !avatar.current) {
    setDebug("Avatar API not initialized");
    return;
  }
  try {
    await avatar.current.speak({
      taskRequest: { text: output, sessionId: data?.sessionId },
    });
    if (!avatarTalking) {
      startRecording();
    }
  } catch (e: any) {
    setDebug(e.message);
  }
}

  return (
    <div className="w-full flex flex-col gap-4">
      <Card>
        <CardBody className="h-[500px] flex flex-col justify-center items-center">
          {stream ? (
            <div className="h-[500px] w-[900px] justify-center items-center flex rounded-lg overflow-hidden">
              <video
                ref={mediaStream}
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              >
                <track kind="captions" />
              </video>
              <div className="flex flex-col gap-2 absolute bottom-3 right-3">
                <Button
                  size="md"
                  onClick={handleInterrupt}
                  className="bg-[#1434CC] rounded-lg"
                  style={{ color: "#F6C00F" }}
                  variant="shadow"
                >
                  Interrupt task
                </Button>
                <Button
                  size="md"
                  onClick={endSession}
                  className="bg-[#1434CC] rounded-lg"
                  style={{ color: "#F6C00F" }}
                  variant="shadow"
                >
                  End session
                </Button>
              </div>
            </div>
          ) : !isLoadingSession ? (
            <div className="h-full justify-center items-center flex flex-col gap-8 w-[500px] self-center">
              <div className="flex flex-col gap-2 w-full">
                <p className="text-sm font-medium leading-none">
                Custom Avatar
                </p>
                <Select
                  placeholder="Select a custom interactive avatar for this session"
                  size="md"
                  onChange={(e) => {
                    setAvatarId(e.target.value);
                  }}
                >
                  {AVATARS.map((avatar) => (
                    <SelectItem
                      key={avatar.avatar_id}
                      textValue={avatar.name}
                    >
                      {avatar.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <p className="text-sm font-medium leading-none">
                  Custom Avatar Voice
                </p>
                <Select
                  placeholder="Select a custom avatar voice for this session"
                  size="md"
                  onChange={(e) => {
                    const selectedVoice = VOICES.find((voice) => voice.voice_id === e.target.value);
                    
                    if (selectedVoice) {
                      setVoiceId(selectedVoice.voice_id);
                      setRate(selectedVoice.rate);
                      setEmotion(selectedVoice.emotion);
                    } else {
                      console.error('Selected voice not found');
                    }
                  }}
                  style={{ fontFamily: 'CustomFont, Medium' }}
                >
                  {VOICES.map((voice) => (
                    <SelectItem 
                      key={voice.voice_id} 
                      value={voice.voice_id}
                      textValue={voice.name}
                      data-voice-id={voice.voice_id}
                      data-rate={voice.rate}
                      data-emotion={voice.emotion}
                    >
                      {voice.name} | {voice.language} | {voice.gender} | {voice.emotion}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <Button
                size="md"
                onClick={startSession}
                className="bg-[#1434CC] w-ful"
                style={{ color: "#F6C00F", fontFamily: 'CustomFont, Medium' }}
                variant="shadow"
              >
                Start session
              </Button>
              
            </div>
          ) : (
            <Spinner size="lg" color="default" />
          )}
        </CardBody>
        <Divider />
        <CardFooter className="flex flex-col gap-3" style={{ fontFamily: 'CustomFont, Medium' }}>
          <InteractiveAvatarTextInput
            label="Interact with the Avatar"
            placeholder="Type a Question for the Avatar"
            input={text}
            onSubmit={handleSpeak}
            setInput={setText}
            disabled={!stream}
            loading={isLoadingRepeat}

            endContent={
              <Tooltip
                content={!recording ? "Start recording" : "Stop recording"}
              >
                <Button
                  onClick={!recording ? startRecording : stopRecording}
                  isDisabled={!stream}
                  isIconOnly
                  className={clsx(
                    "mr-4 text-white",
                    !recording
                      ? "bg-gradient-to-tr from-blue-500 to-blue-300"
                      : ""
                  )}
                  size="sm"
                  variant="shadow"
                >
                  {/* Use the SVG as the Button Content */}
                  {!recording ? (
                    <img
                      src="/noun-microphone-7075173-1434CC.svg"
                      alt="Start recording"
                      style={{ width: '20px', height: '20px' }} // Adjust size as needed
                    />
                  ) : (
                    <>
                      <div className="absolute h-full w-full bg-gradient-to-tr from-blue-500 to-blue-300 animate-pulse -z-10"></div>
                      <img
                        src="/noun-microphone-7075173-1434CC.svg"
                        alt="Stop recording"
                        style={{ width: '20px', height: '20px' }} // Adjust size as needed
                      />
                    </>
                  )}
                </Button>
              </Tooltip>
            }
          />
        </CardFooter>
      </Card>
      
      <p className="font-mono text-right" style={{ fontFamily: 'CustomFont, Medium' }}>
        <span className="font-bold">Avatar Response:</span>
        <br />
        {MODELOUTPUT}
      </p>
      {/* This is the console output for debugging comment when you don't want it showing */}
      <p className="font-mono text-right" style={{ fontFamily: 'CustomFont, Medium' }}>
        <span className="font-bold">Console:</span>
        <br />
        {debug}
      </p>
    </div>
  );
}
