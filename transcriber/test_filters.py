#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Test script to verify proper noun correction filters work correctly.
"""

from proper_nouns import apply_heuristic_filters, is_common_word, passes_phonetic_similarity

# Simulated corrections from do.md
test_corrections = [
    {
        'original': 'American',
        'suggested': 'America',
        'confidence': 'high',
        'occurrences': 20,
        'contexts': ['...and how it compares to the American model, strengths, weaknesses...']
    },
    {
        'original': 'New York',
        'suggested': 'New York Times',
        'confidence': 'high',
        'occurrences': 9,
        'contexts': ['...would say much more functional than New York City. But I was feeling...']
    },
    {
        'original': 'Dan Wong',
        'suggested': 'Dan Wang',
        'confidence': 'high',
        'occurrences': 3,
        'contexts': ['...to remain the world\'s leading power. Dan Wong is a research fellow...']
    },
    {
        'original': 'Russia',
        'suggested': 'Ross',
        'confidence': 'high',
        'occurrences': 2,
        'contexts': ['...autocratic than China today, namely Stalin\'s Russia, Stalin\'s Soviet Union...']
    },
    {
        'original': 'Russ',
        'suggested': 'Ross',
        'confidence': 'high',
        'occurrences': 1,
        'contexts': ['...Times. Thank you for having me, Russ. You\'re very welcome...']
    },
    {
        'original': 'As',
        'suggested': 'States',
        'confidence': 'medium',
        'occurrences': 78,
        'contexts': ['...States? My framing of China is as an engineering state because...']
    },
    {
        'original': 'Engineers',
        'suggested': 'Engineer',
        'confidence': 'medium',
        'occurrences': 16,
        'contexts': ['...that China is a society of engineers, It\'s ruled by engineers...']
    },
    {
        'original': 'Doesn',
        'suggested': 'Does',
        'confidence': 'high',
        'occurrences': 10,
        'contexts': ['...So China builds and the US doesn\'t. And one of your arguments...']
    },
    {
        'original': 'He',
        'suggested': 'How',
        'confidence': 'medium',
        'occurrences': 9,
        'contexts': ['...The game goes to he who outlasts the adversary. And what...']
    },
    {
        'original': 'Though',
        'suggested': 'Thoughts',
        'confidence': 'medium',
        'occurrences': 3,
        'contexts': ['...is still overwhelmingly positive for China. Though you have these bridges...']
    },
    {
        'original': 'Hawaii',
        'suggested': 'How',
        'confidence': 'medium',
        'occurrences': 1,
        'contexts': ['...something like seize Guam or seize Hawaii, then I think it is...']
    },
]

def test_individual_filters():
    """Test individual filter functions."""
    print("="*60)
    print("TESTING INDIVIDUAL FILTERS")
    print("="*60)

    # Test common word detection
    print("\n1. Common Word Detection:")
    test_words = ['American', 'Engineers', 'Hawaii', 'Dan', 'Wang', 'As', 'He', 'Though']
    for word in test_words:
        result = is_common_word(word)
        print(f"   '{word}': {'COMMON' if result else 'NOT COMMON'}")

    # Test phonetic similarity
    print("\n2. Phonetic Similarity (threshold=3):")
    test_pairs = [
        ('Dan Wong', 'Dan Wang'),
        ('Russ', 'Ross'),
        ('Russia', 'Ross'),
        ('Hawaii', 'How'),
        ('As', 'States'),
        ('American', 'America'),
    ]
    for orig, sugg in test_pairs:
        result = passes_phonetic_similarity(orig, sugg, threshold=3)
        print(f"   '{orig}' → '{sugg}': {'PASS' if result else 'FAIL'}")

def test_full_pipeline():
    """Test the full filtering pipeline."""
    print("\n" + "="*60)
    print("TESTING FULL PIPELINE")
    print("="*60)

    print(f"\nTotal candidates before filtering: {len(test_corrections)}")
    print("\nCandidates:")
    for c in test_corrections:
        print(f"  - {c['original']} → {c['suggested']} ({c['confidence']}, {c['occurrences']} occurrences)")

    # Apply filters
    filtered = apply_heuristic_filters(test_corrections)

    print("\n" + "="*60)
    print(f"RESULT: {len(filtered)} candidates passed filters")
    print("="*60)

    if filtered:
        print("\nSurviving candidates:")
        for c in filtered:
            print(f"  ✓ {c['original']} → {c['suggested']} ({c['confidence']}, {c['occurrences']} occurrences)")
    else:
        print("\nNo candidates passed all filters!")

    # Show expected results
    print("\n" + "="*60)
    print("EXPECTED RESULTS:")
    print("="*60)
    print("Should PASS:")
    print("  ✓ Dan Wong → Dan Wang (proper noun, phonetically similar)")
    print("  ✓ Russ → Ross (proper noun, phonetically similar)")
    print("\nShould FAIL:")
    print("  ✗ American → America (common word)")
    print("  ✗ New York → New York Times (multi-word mismatch)")
    print("  ✗ Russia → Ross (common word, not similar)")
    print("  ✗ As → States (common word, not similar)")
    print("  ✗ Engineers → Engineer (common word)")
    print("  ✗ Doesn → Does (contraction)")
    print("  ✗ He → How (common word)")
    print("  ✗ Though → Thoughts (common word)")
    print("  ✗ Hawaii → How (common word, not similar)")

if __name__ == '__main__':
    test_individual_filters()
    test_full_pipeline()
