\version "2.24.0"
\language "english"
% Semantic microfixture for explicit-regeneration LilyPond export tests.
% Pickup + whole + staccato eighth + tie chain + repeated passage with two
% distinct alternatives. Lower voice is rhythm-matched silence (not asserted).
microUpper = \relative c' {
  \partial 4 c4 |
  e1 |
  d8-. |
  e1~ e1 |
  \repeat volta 2 {
    f2 g4 a4 |
  }
  \alternative {
    { b2 | }
    { c2 | }
  }
}
microLower = \relative c {
  \partial 4 s4 |
  s1 |
  s8 |
  s1 s1 |
  \repeat volta 2 {
    s2 s4 s4 |
  }
  \alternative {
    { s2 | }
    { s2 | }
  }
}
