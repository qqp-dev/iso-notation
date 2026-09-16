\version "2.24.0"
\language "english"
% Tie-kind microfixtures for fail-closed tie validation (real LilyPond parser).
% Valid: chord-wide partial <c e>2~ e8 (only E continues; C never recurs).
% Invalid: per-note <c~ e>2 d4 c4 (C tied but next C nonadjacent, no tieWait).
microTieValidUpper = \relative c' {
  <c e>2~ e8 r8 r4 |
}
microTieValidLower = \relative c {
  s2 s8 s8 s4 |
}
microTieInvalidUpper = \relative c' {
  <c~ e>2 d4 c4 |
}
microTieInvalidLower = \relative c {
  s2 s4 s4 |
}
