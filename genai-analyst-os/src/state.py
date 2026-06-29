"""PipelineState dataclass for the GenAI Analyst Pipeline eval harness (Python tooling layer only)."""

from dataclasses import dataclass, field
from typing import Literal


@dataclass
class PipelineState:
    """Local simulation of pipeline state for evals and scripts.

    Mirrors the Postgres tables used by the production Edge Function pipeline.
    Each field corresponds to a phase of the overnight crawl → summarise → rank → ideas chain.
    Not used in production — production state lives entirely in Supabase Postgres.
    """

    # --- crawl phase ---
    user_id: str = ""
    sources: list[dict] = field(default_factory=list)       # UserSource dicts
    raw_articles: list[dict] = field(default_factory=list)  # RawArticle dicts
    summaries: list[dict] = field(default_factory=list)     # SummaryResult dicts
    embeddings: list[list[float]] = field(default_factory=list)  # vector(384) per article

    # --- rank phase ---
    topic_weights: dict[str, float] = field(default_factory=dict)
    feed_items: list[dict] = field(default_factory=list)    # {article_id, blend_score}

    # --- ideas phase ---
    style_seed: str = "practitioner"
    daily_ideas: list[dict] = field(default_factory=list)   # IdeaAngle dicts

    # --- draft phase ---
    selected_angle: dict | None = None
    pov_bullets: list[str] = field(default_factory=list)
    draft_format: Literal["substack", "linkedin"] = "substack"
    draft_content: str = ""

    # --- pipeline control ---
    errors: list[dict] = field(default_factory=list)        # {node, message, skipped}
    mock_mode: bool = False
    crawl_run_id: str = ""  # UUID of the open crawl_runs row; set by crawler, closed by ideas
