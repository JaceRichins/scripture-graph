"""Secondary-source discovery, admission, and ingestion.

Selective by design: sources pass a structured quality rubric (source level
AND item level) before anything is ingested, extracted claims enter the
evidence pipeline as TENTATIVE (never trusted on reputation), and vault notes
carry metadata/summaries/timestamps/attribution — never bulk transcripts.
"""
