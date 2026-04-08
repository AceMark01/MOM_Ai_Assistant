import os
import logging
import asyncio
import assemblyai as aai
from typing import List
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.config import get_settings

logger = logging.getLogger("ai_service")
settings = get_settings()

# Initialize AssemblyAI with the API key from settings
aai.settings.api_key = settings.ASSEMBLY_AI_API_KEY

class AIService:
    """
    AI Service using AssemblyAI for Cloud STT and LangChain (OpenAI) 
    for Hierarchical Summarization with EXTENSIVE DEBUG LOGGING.
    """

    @classmethod
    async def transcribe_audio(cls, audio_path: str) -> str:
        """Transcribe audio using AssemblyAI Cloud STT via direct REST API Call with full transcript logging."""
        logger.info(f"🎤 [DEBUG] STARTING TRANSCRIPTION: {audio_path}")
        try:
            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Audio file not found at: {audio_path}")

            import requests

            base_url = "https://api.assemblyai.com"
            headers = {"authorization": settings.ASSEMBLY_AI_API_KEY}

            # 1. Upload Local File
            logger.info("📡 [DEBUG] Uploading file to AssemblyAI...")
            def _upload():
                with open(audio_path, "rb") as f:
                    response = requests.post(f"{base_url}/v2/upload", headers=headers, data=f)
                    response.raise_for_status()
                    return response.json()["upload_url"]
            audio_url = await asyncio.to_thread(_upload)

            # 2. Trigger Transcription
            logger.info("📡 [DEBUG] Starting transcription task with language detection & advanced models...")
            data = {
                "audio_url": audio_url,
                "language_detection": True,
                "speech_models": ["universal-3-pro", "universal-2"],
                "speaker_labels": True,
                "punctuate": True,
                "format_text": True
            }
            def _start_transcription():
                response = requests.post(f"{base_url}/v2/transcript", json=data, headers=headers)
                response.raise_for_status()
                return response.json()['id']
            transcript_id = await asyncio.to_thread(_start_transcription)

            # 3. Poll for Completion
            polling_endpoint = f"{base_url}/v2/transcript/{transcript_id}"
            logger.info("⏳ [DEBUG] Polling for completion...")
            
            while True:
                def _poll():
                    response = requests.get(polling_endpoint, headers=headers)
                    response.raise_for_status()
                    return response.json()
                result = await asyncio.to_thread(_poll)
                
                status = result['status']
                if status == 'completed':
                    break
                elif status == 'error':
                    error_msg = result.get('error', 'Unknown Error')
                    if "no spoken audio" in error_msg.lower():
                        logger.warning("⚠️ [DEBUG] No speech detected in the audio file.")
                        return "No speech detected in this recording."
                    raise Exception(f"AssemblyAI Error: {error_msg}")
                
                logger.info(f"⏳ [DEBUG] AssemblyAI Status: {status}...")
                await asyncio.sleep(3)

            # 4. Process Result
            formatted_text = ""
            utterances = result.get('utterances', [])
            
            if utterances:
                logger.info(f"✅ [DEBUG] Transcription SUCCESS! Word count: {len(result.get('text', '').split())}")
                for utterance in utterances:
                    line = f"Speaker {utterance.get('speaker', 'A')}: {utterance.get('text', '')}"
                    formatted_text += line + "\n"
                    # Log every line so the user can see it in terminal
                    logger.info(f"📝 [TRANSCRIPT LINE] {line}")
            else:
                formatted_text = result.get('text', '')
                logger.info(f"✅ [DEBUG] Transcription SUCCESS! Word count: {len(formatted_text.split())}")
                logger.info(f"📝 [FULL TRANSCRIPT] {formatted_text}")

            return formatted_text
        except Exception as e:
            logger.error(f"❌ [DEBUG] Transcription failed: {e}")
            raise e

    @classmethod
    def _get_chunks(cls, text: str) -> List[str]:
        """Split text into manageable chunks (~3000 words each)."""
        words = text.split()
        chunk_size = 3000 
        return [" ".join(words[i:i + chunk_size]) for i in range(0, len(words), chunk_size)]

    @classmethod
    async def summarize_transcript(cls, transcript: str, agenda: str = "No specific agenda provided.") -> dict:
        """
        Hierarchical Summarization using LangChain with step-by-step logs.
        """
        word_count = len(transcript.split())
        logger.info(f"🧠 [DEBUG] STARTING SUMMARIZATION: {word_count} words total.")

        if not transcript or word_count < 20:
            logger.warning("⚠️ [DEBUG] Transcript is too small for AI extraction.")
            placeholder = "Transcript too short for meaningful AI extraction."
            return {
                "final_summary": placeholder,
                "formatted_summary": placeholder,
                "brief_summary": "N/A (Short Recording)",
                "chunk_summaries": [],
                "full_transcript": transcript
            }

        llm = ChatOpenAI(
            model=settings.OPENAI_MODEL or "gpt-4o-mini",
            api_key=settings.OPENAI_API_KEY,
            temperature=0
        )

        # 1. Map Stage
        chunks = cls._get_chunks(transcript)
        logger.info(f"📊 [DEBUG] Chunking transcript into {len(chunks)} segments.")
        
        map_prompt = ChatPromptTemplate.from_template(
            "Extract significant discussion points, technical details, material numbers, decisions, **Action Items (Tasks)**, and **Recommended Next Steps** from this meeting segment. "
            "Use the provided Official Agenda as strategic context, and ALSO capture relevant topics discussed outside the agenda. "
            "\n\nOFFICIAL AGENDA REFERENCE:\n{agenda}\n\n"
            "CRITICAL INSTRUCTIONS:\n"
            "1. CLASSIFICATION: Classify points into two buckets: (a) Agenda-linked discussion, and (b) Off-agenda discussion.\n"
            "2. COMPREHENSIVE EXTRACTION: Do not ignore significant off-agenda topics, decisions, risks, blockers, or commitments.\n"
            "3. MODERATE DETAIL: For each important topic, include context, key discussion points, conclusion/outcome, and impact.\n"
            "4. ACTION ITEMS: Explicitly extract any task discussed. Label unassigned tasks as 'General Action Items'.\n"
            "5. RECOMMENDATIONS: Capture suggestions or proposed strategic steps mentioned.\n"
            "6. NOISE FILTERING: Discard minor conversational noise (e.g., temporary calculation mistakes), but retain final strategic conclusions and material figures.\n"
            "7. IF NO AGENDA PROVIDED: If the agenda is missing or says 'No specific agenda provided.', infer primary meeting themes from the segment and treat those as agenda-equivalent discussion.\n"
            "8. OUTPUT FORMAT (strict):\n"
            "**AGENDA-LINKED TOPICS:**\n"
            "- ...\n"
            "**OFF AGENDA TOPICS:**\n"
            "- ... (if none, write: No off-agenda topics in this segment.)\n"
            "**DECISIONS / ACTIONS / NEXT STEPS:**\n"
            "- ...\n"
            "\n\nSegment:\n{text}"
        )
        map_chain = map_prompt | llm | StrOutputParser()
        
        chunk_summaries = []
        for i, chunk in enumerate(chunks):
            logger.info(f"🕒 [DEBUG] Summarizing Chunk {i+1}/{len(chunks)} (Input: {len(chunk.split())} words)...")
            summary = await map_chain.ainvoke({"text": chunk, "agenda": agenda})
            chunk_summaries.append(summary)
            logger.info(f"✨ [CHUNK SUMMARY {i+1}] {summary[:200]}...")

        # 2. Reduce Stage (Formal MOM)
        logger.info("🔥 [DEBUG] Merging all segments into professional MOM...")
        
        reduce_prompt = ChatPromptTemplate.from_template(
            "Synthesize these segment summaries into a professional, formal MOM report in English. "
            "Use the Official Agenda as the primary structure when provided: \n{agenda}\n\n"
            "CRITICAL OUTPUT RULES:\n"
            "1. Produce the report with these headers in order:\n"
            "   **EXECUTIVE SUMMARY:**\n"
            "   **AGENDA TOPICS DISCUSSED:**\n"
            "   **OFF AGENDA TOPICS:** (include ONLY if off-agenda topics exist)\n"
            "   **DECISIONS MADE:**\n"
            "   **ACTION ITEMS:**\n"
            "   **RECOMMENDED TASKS & NEXT STEPS:**\n"
            "2. Agenda Coverage: Summarize each agenda topic discussed with moderate detail (context, key points, final outcome, and impact).\n"
            "3. Off-Agenda Coverage: Include all significant non-agenda discussions under **OFF AGENDA TOPICS:**. Do not merge them into agenda sections.\n"
            "4. Conditional Header Rule: If no meaningful off-agenda discussion exists, omit **OFF AGENDA TOPICS:** entirely.\n"
            "5. Detail Level: Keep it informative and detailed without being verbose; use clear bullet points and concrete outcomes.\n"
            "6. If no agenda is provided, infer major meeting themes and treat them as primary discussion under **AGENDA TOPICS DISCUSSED:**.\n\n"
            "Summaries:\n{summaries}"
        )
        reduce_chain = reduce_prompt | llm | StrOutputParser()
        
        combined_summaries_text = "\n\n".join(chunk_summaries)
        final_summary = await reduce_chain.ainvoke({"summaries": combined_summaries_text, "agenda": agenda})

        # 3. Beautify Stage (Formatted Narrative Summary)
        logger.info("✨ [DEBUG] Generating well-formatted Final Summary report...")
        beautify_prompt = ChatPromptTemplate.from_template(
            "Create a COMPREHENSIVE STRATEGIC INTELLIGENCE BRIEFING report in English. "
            "CRITICAL FORMATTING INSTRUCTIONS:\n"
            "1. Use bold uppercase section headers with colons.\n"
            "2. Use this structure:\n"
            "   **EXECUTIVE SUMMARY:**\n"
            "   **AGENDA TOPICS DISCUSSED:**\n"
            "   **OFF AGENDA TOPICS:** (include ONLY when such topics exist)\n"
            "   **DECISIONS MADE:**\n"
            "   **ACTION ITEMS:**\n"
            "   **RECOMMENDED TASKS & NEXT STEPS:**\n"
            "3. Agenda section must follow official agenda context where available: \n{agenda}\n\n"
            "4. Off-agenda section must include significant topics discussed outside agenda, with concise but informative bullets.\n"
            "5. Use moderate detail under each section (key context, outcomes, metrics, and implications).\n"
            "6. Keep all content in plain bullet points (-), no long narrative paragraphs.\n"
            "7. If no agenda exists, infer primary themes and list them under **AGENDA TOPICS DISCUSSED:**.\n"
            "8. If no off-agenda topics exist, omit **OFF AGENDA TOPICS:**.\n"
            "\n\nSummaries:\n{summaries}"
        )
        beautify_chain = beautify_prompt | llm | StrOutputParser()
        formatted_summary = await beautify_chain.ainvoke({"summaries": combined_summaries_text, "agenda": agenda})

        # 4. Dashboard Stage (Balanced Narrative Summary for UI Autofill)
        logger.info("📊 [DEBUG] Extracting balanced dashboard summary points...")
        dashboard_prompt = ChatPromptTemplate.from_template(
            "Generate a high-impact, point-wise professional summary for a web dashboard. "
            "CRITICAL FORMATTING INSTRUCTIONS:\n"
            "1. Use bold uppercase headers with this structure:\n"
            "   **EXECUTIVE SUMMARY:**\n"
            "   **AGENDA TOPICS DISCUSSED:**\n"
            "   **OFF AGENDA TOPICS:** (include ONLY when off-agenda topics exist)\n"
            "   **DECISIONS MADE:**\n"
            "   **ACTION ITEMS:**\n"
            "   **RECOMMENDED TASKS & NEXT STEPS:**\n"
            "2. Agenda coverage: Reference official agenda ({agenda}) and summarize each agenda topic with moderate detail.\n"
            "3. Off-agenda coverage: Include all significant non-agenda discussions under **OFF AGENDA TOPICS:**.\n"
            "4. Detail policy: Use informative bullets that include what was discussed, what was concluded, and what it means.\n"
            "5. Keep it point-wise only using bullet points (-). No long paragraphs.\n"
            "6. If no agenda is provided, infer primary themes and put them under **AGENDA TOPICS DISCUSSED:**.\n"
            "7. If no off-agenda topics exist, omit **OFF AGENDA TOPICS:**.\n"
            "8. Preserve strategic signal: emphasize final outcomes, commitments, metrics, and deadlines; ignore conversational noise.\n"
            "\n\nSummaries:\n{summaries}"
        )
        dashboard_chain = dashboard_prompt | llm | StrOutputParser()
        brief_summary = await dashboard_chain.ainvoke({"summaries": combined_summaries_text, "agenda": agenda})

        logger.info("🏁 [DEBUG] AI Pipeline Finished Successfully.")
        return {
            "final_summary": final_summary,            # Formal MOM
            "formatted_summary": formatted_summary,    # Well-formatted synthesis
            "brief_summary": brief_summary,            # Dashboard points
            "chunk_summaries": chunk_summaries,        # Audit logs
            "full_transcript": transcript              # Verbatim
        }