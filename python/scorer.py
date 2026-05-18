import json
import math
import re
import sys


VIRAL_WORDS = {
    "id": ["lucu", "gila", "kaget", "viral", "parah", "banget", "serius", "aneh", "kok", "kenapa", "ternyata"],
    "en": ["funny", "crazy", "shocked", "viral", "wild", "seriously", "weird", "why", "actually", "unexpected"],
}

INSIGHT_WORDS = {
    "id": ["intinya", "strategi", "data", "penting", "pelajaran", "cara", "nilai", "hasil", "masalah"],
    "en": ["strategy", "data", "important", "lesson", "value", "result", "problem", "insight", "because"],
}

CONFLICT_WORDS = {
    "id": ["tapi", "salah", "konflik", "masalah", "debat", "tidak setuju", "bohong", "marah"],
    "en": ["but", "wrong", "conflict", "problem", "debate", "disagree", "lie", "angry"],
}


def count_terms(text, terms):
    lowered = text.lower()
    return sum(lowered.count(term) for term in terms)


def density_score(text, duration):
    words = re.findall(r"\w+", text)
    if duration <= 0:
        return 0
    wps = len(words) / duration
    return min(25, max(0, wps * 8))


def duration_score(duration, min_duration, max_duration):
    target = (min_duration + max_duration) / 2
    spread = max(1, (max_duration - min_duration) / 2)
    return max(0, 20 - (abs(duration - target) / spread) * 12)


def score_clip(clip, payload):
    text = clip.get("text", "")
    duration = float(clip.get("duration", 0))
    language = payload.get("language", "id")
    preset = payload.get("preset", "").lower()
    min_duration = float(payload.get("minDuration", 30))
    max_duration = float(payload.get("maxDuration", 60))

    terms = []
    terms.extend(VIRAL_WORDS.get(language, VIRAL_WORDS["id"]))
    if "edukasi" in preset or "insight" in preset:
        terms.extend(INSIGHT_WORDS.get(language, INSIGHT_WORDS["id"]) * 2)
    if "drama" in preset or "konflik" in preset:
        terms.extend(CONFLICT_WORDS.get(language, CONFLICT_WORDS["id"]) * 2)

    term_hits = count_terms(text, terms)
    question_hits = text.count("?")
    exclaim_hits = text.count("!")
    quote_energy = min(12, question_hits * 3 + exclaim_hits * 2)
    term_score = min(28, term_hits * 4)
    dense = density_score(text, duration)
    dur = duration_score(duration, min_duration, max_duration)
    length_bonus = min(10, math.log(max(len(text), 1), 2))

    score = term_score + quote_energy + dense + dur + length_bonus
    return {
        **clip,
        "score": round(score, 2),
        "scoreDetails": {
            "termHits": term_hits,
            "termScore": round(term_score, 2),
            "densityScore": round(dense, 2),
            "durationScore": round(dur, 2),
            "quoteEnergy": round(quote_energy, 2),
        },
    }


def main():
    payload = json.loads(sys.stdin.read() or "{}")
    clips = payload.get("clips", [])
    scored = [score_clip(clip, payload) for clip in clips]
    scored.sort(key=lambda item: item.get("score", 0), reverse=True)
    limit = int(payload.get("limit", 40))
    print(json.dumps({"clips": scored[:limit]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
