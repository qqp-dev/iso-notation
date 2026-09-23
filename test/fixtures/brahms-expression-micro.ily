% Real-compiler expression witness, with intentional source locations.
mxSUD = \sustainOff\sustainOn
mxUpper = { \partial 4 c'4\sf\< \after 8 \! | \repeat volta 2 { d'2 e'2 } \alternative { { f'1 } { g'1 } } }
mxLower = { \partial 4 s4 | \repeat volta 2 { s1 } \alternative { { s1 } { s1 } } }
mxDynamics = { \partial 4 s4\p | \repeat volta 2 { s8\< s8\! s4\f s4\sf\> s4\! } \alternative { { s1\p } { s1\f } } }
% Two literal stops, only the first closes a span; both have compiler origins.
mxRedundant = { \partial 4 s4 | s8\< s8\! s8\! s8 }
mxPedal = { \partial 4 s4\sustainOn | \repeat volta 2 { s4-\tag layout \sustainOn -\tag midi \mxSUD s4\sustainOn s2\mxSUD } \alternative { { s1\sustainOff } { s1\sustainOff } } }
