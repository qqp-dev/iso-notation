%...+....1....+....2....+....3....+....4....+....5....+....6....+....7....+....

\version "2.24"
\language "english"

\include "global-variables.ily"
\include "spline-sandwitch.ily"

%%% Positions and shapes %%%

slurShapeA = \shape #'(
                        ((0 . 0) (0 . -9) (0 . -8) (0 . 7))
                        ((0 . 0) (0 . 0) (0 . 0) (0 . 0))
                      ) \etc
slurShapeB = \shape #'((0 . 0) (0 . 0) (0 . 1) (0 . 0)) \etc
slurShapeC = \shape #'((0 . 0) (0 . -1) (0 . 1) (0 . 0)) \etc
slurShapeD = \shape #'((0 . 0) (0 . -3) (-2 . 3) (0 . 2.5)) \etc
slurShapeE = \shape #'((0 . 0) (0 . 0) (0 . 0) (0 . -4.5)) \etc
slurShapeF = \shape #'(
                        ((0 . 2) (0 . 1) (0 . 0) (0 . 0))
                        ((0 . 0) (2 . 1.5) (-4 . -2) (0 . 2.5))
                      ) \etc
slurShapeG = \shape #'((-3 . -2) (-1 . 1) (0 . 0) (0 . 0)) \etc

beamPositionsA = \once \override Beam.positions = #'(3 . 8)
beamPositionsB = \once \alterBroken positions #'((2 . 6) (5 . 7)) Beam
beamPositionsC = \once \override Beam.positions = #'(3 . 8)

moveNoteA = \once \override NoteColumn.force-hshift = -1
moveNoteB = \once \override NoteColumn.force-hshift = 1.4
moveNoteC = \once \override NoteColumn.force-hshift = -0.2
moveNoteD = \once \override NoteColumn.force-hshift = -1
moveNoteE = \once \override NoteColumn.force-hshift = 1.4

%%% Music %%%

global = {
  \time 2/2
  \key c \major
}

rightHandUpper = \relative {
  \repeat volta 2 {
    \partial 4 <c'' c'>4( |
    <bf bf'>2. <a a'>4) |
    s2 s8 r q4( |
    <g g'>2. <f f'>4) |
    s2 s8 r s4 |
    s2 \voiceOne a4( b |
    <d,! a' d!>2_\espressivo <c c'>4) r |
    <a b d f! a>2^\< \after 4 \! <af b af'> |
    <f g b f' g>2^\sf^\> \after 4 \! <e' g> |
    
    \barNumberCheck 9
    \moveNoteD <f g>1^\dimRitSpanner |
    \after 2 \stopTextSpan <e g>2.
  }
  \repeat volta 2 {
    g'4 |
    f2. e4 |
    \oneVoice <c ds fs c'>2->-\slurShapeD \(~  c'8 a( fs ds |
    \voiceOne c8) \osp #'(0 . -1) b( gs f!  d) \staffDown c-\slurShapeE (
      a fs |
    ds2) e4\) \staffUp \voiceOne <c' c'>( |
    <cs cs'>2. <d d'>4) |
    \oneVoice <f gs b! f'>2->(~  f'8 d b gs |
    
    \barNumberCheck 17
    f8 e cs bf)  r e'( cs as |
    g8 fs ds c)  r a''( fs a, |
    a'8 e a, a')  <g, c! g'>4.( <fs fs'>8) |
    r8 c''( a c,  a' g c, c') |
    \voiceOne <bf, bf'>2.( <a a'>4) |
    s2 s8 \oneVoice r <e' e'>4( |
    \voiceOne d'2~ d8 b c fs, |
    g8 e c fs, \oneVoice <g, g'>) r \voiceOne <e' e'>4( |
    
    \barNumberCheck 25
    <g c g'>2 <f! f'!>4)_( r |
    <e bf' e>2 <d d'>4) r |
    <c c'>2 <b! gs' b!> |
    <f' gs>2 <e a> |
    \alternative {
      { 
        \moveNoteA <f gs>1( |
        <e a>2.) 
      }
      {  
        \set Score.voltaSpannerDuration = #(ly:make-moment 4/4)
        <f gs>2( <e a> |
        <ds a'>2 <fs a>) |
        \voiceDown e,,2-\slurShapeF \(~ e8 a c ds |
        
        \barNumberCheck 33
        fs8 a \voiceUp c ds  fs a c ds |
        fs8 a c ds  \oneVoice fs e( c a |
        fs8) f( d! b  gs) g( e cs |
        bf4.)\) r8 a2~ |
        a4 r <d d'>2^( |
        \moveNoteC <c! c'!>1~ |
        q2 <b b'>) |
        \after 4. ^\dimRit <e, cs' e>1~ |
        q1 |
        <cs'' a' cs>2.\fermata 
      }
    }
  }
  \fine
}

rightHandLower = \relative { 
  \repeat volta 2 {
    \partial 4 s4 |
    \voiceOne e''1
    s1 |
    c1 |
    s2. \oneVoice <f, f'>4( |
    <e a e'>2 \voiceFour <ds ds'>4) r |
    s2 f!4( fs |
    s2 d4 e) |
    f4( d b c) |
    
    \barNumberCheck 9
    \moveNoteE <f, g b f'>2.( d'4 |
    b2 c4)
  }
  \repeat volta 2 {
    <g' g'>4^( |
    <gs gs'>2. <a a'>4) |
    s1*2 |
    s2. c,4 |
    bf'2. a4 |
    s1 |
    
    \barNumberCheck 17
    s1*4 |
    e'1 |
    s1 |
    <d g>2. c4 |
    g4 c, s2 |
    
    \barNumberCheck 25
    s2 b'4 c |
    s2 gs4 a( |
    fs4 g d e) |
    <gs, f'>4( d' b c) |
    \alternative {
      { 
        \moveNoteB <gs f'>2.(^\dimRit d'4 |
        b2 c4) 
      }
      {  
        <gs f'>4( d' b c) |
        b4( c) b( c) |
        s1 |
        
        \barNumberCheck 33
        s1*5 |
        f1~ |
        f1 |
        
      }
    }
  }
}

rightHand = \relative {
  \global
  <<
    \new Voice \rightHandUpper
    \new Voice \rightHandLower
  >>
}

leftHandUpper = \relative { 
  \repeat volta 2 {
    \partial 4 s4 |
    \voiceThree \beamPositionsA 
    % See spline-sandwitch.ily
    \once \override Slur.stencil = #slur::stencil-from-anchors
    \tweak Stem.details.anchor #'((0 . 0.3) (3 . 1.2))
    \tweak Stem.details.anchor-alignment #'(0 . 1)
    c,8_([ e c'
    \tweak Stem.details.anchor #'(0 . 1)
    \tweak Stem.details.anchor-alignment #'(0 . 1)
    e  c' e, c 
    \tweak Stem.details.anchor #'(0 . 2.8)
    \tweak Stem.details.anchor-alignment #'(0 . 1)
    a' |
    \voiceUp c8
    \tweak NoteHead.details.anchor #'(0.5 . 3)
    a' c 
    \tweak NoteHead.details.anchor #'(0 . 3.5)
    e]  
    \once \override NoteHead.details.anchor = #'(0 . 1)
    c') s4. |
    \override Beam.breakable = ##t
    \beamPositionsB
    \voiceDown a,,,,8-\slurShapeA ([ c a' c  a' c, a f' |
    \voiceUp a8 f' a c]  a') s4. | 
    s2 \voiceDown a,,4 b |
    s2 f4 fs |
    s2 d4 e |
    s1 |
    
    \barNumberCheck 9
    s1 |
    s2.
  }
  \repeat volta 2 {
    s4 |
    s2 d'4 c |
    a'8( fs ds c \oneVoice a) s4. |
    s1*2 |
    \voiceThree g2.( f4) |
    d'8( b gs f \oneVoice d) s4. |
    
    \barNumberCheck 17
    s2 \voiceThree as |
    b2 bs |
    cs2 s |
    ds2 e |
    \beamPositionsC
    % See spline-sandwitch.ily
    \once \override Slur.stencil = #slur::stencil-from-anchors
    \tweak Stem.details.anchor #'(0 . 4)
    c,8([ 
    \tweak Stem.details.anchor #'(0 . 4.5)
    e c' e c' e, 
    \tweak Stem.details.anchor #'(0 . 6)
    c a' |
    \voiceUp c8 a' 
    \tweak NoteHead.details.anchor #'(0 . 3)
    c a']  
    \once \override NoteHead.details.anchor = #'(0 . 1)
    c) s4. |
    s1*2 |
    
    \barNumberCheck 25
    s1*4 |
    \alternative {
      { 
        \voiceDown a,,,,8( b' a d_~ <a d f>2) |
        a,8( a' a e'_~ <a, e'>4) 
      }
      {  
        s1 |
        fs2 ds |
        s1 |
        
        \barNumberCheck 33
        s1*3 |
        g'!8[ a, d fs]_~ \oneVoice <a, d fs>2~ |
        q8 \voiceThree a d f!_~ <a, d f>2 |
        s1*3 |
        
        \barNumberCheck 41
        s2. a,4 |
        s2.
      }
    }
  }
}

leftHandLower = \relative { 
  \repeat volta 2 {
    \partial 4 r4 |
    \voiceTwo s2.. \hideNoteHead a8~ |
    <e a e'>2.-> \oneVoice r4 |
    s2.. \voiceTwo \hideNoteHead f8~ |
    <c f c'>2.-> \oneVoice r4 |
    f,,8-\slurShapeB ( f' c' f \voiceTwo a f b f) |
    \oneVoice fs,,8-\slurShapeC ( fs' ef' a \voiceTwo f! a, fs' a,) |
    \oneVoice g,8( g' b f') \voiceTwo d( g, e' g,) |
    \oneVoice c,8( g' d' g,  c, g' e' g,) |
    
    \barNumberCheck 9
    c,8_( g' d' g,  c, g' f' g, |
    c,8 g' e' g,  e'4)
  }
  \repeat volta 2 {
    <e c' e>4 |
    \voiceTwo e,8^( d' e b'  d e, c' e,) |
    <a a'>2-> s8 \oneVoice r r e,,( |
    e'8 gs b d) \voiceTwo e,( a c ds) |
    e,8([ a c e,  gs b a e')] |
    g!8 e a, a,  a' e' f a, |
    <d d'>2-> s8 \oneVoice r r a,( |
    
    \barNumberCheck 17
    a'8 cs e g) \voiceTwo as,( cs e g |
    b,8 ds fs a)  bs,( fs' a ds |
    cs,8 e a cs)  d,,!^( d' a' c!) |
    ds,8( a' c fs  e, g c e) |
    s2.. \hideNoteHead a,8~ |
    <e a e'>2.-> \oneVoice r4 |
    \stemDown <e,, e'>8([\arpeggio g' e' g  e' g, e c'] |
    e,8 c e c  \stemNeutral e,) r r4 |
    
    \barNumberCheck 25
    \stemDown a,8( a' c a'  a, b' a c) |
    g,8( bf e bf'  f, gs' f a) |
    e,8( fs' e g!  e, d' b e) |
    a,,8([ b' a f'  a, e' a, c)] |
    \alternative {
      { 
        s4 \voiceTwo a~ \hideNoteHead a2 |
        s4 a~ \hideNoteHead a 
      }
      {  
        \oneVoice \stemDown a,8([ b' a f'  a, e' a, c)] |
        \voiceTwo fs,8( ds' a c  ds, fs' a, c) |
        e,1~ |
        
        \barNumberCheck 33
        e1~ |
        \oneVoice e2~ e8 e( a c |
        ds8) e,( b' d  f) e,_( cs' e |
        \set tieWaitForNote = ##t
        \hideNoteHead g) \voiceTwo a,4.*1/3~ d4~ \hideNoteHead <a d>2 |
        s8 a4.*1/3~ d4~ \hideNoteHead <a d>2 |
        \oneVoice d,,8( gs d' gs  d' gs, d gs |
        d' gs d' gs,  d gs, d d,) |
        a8( a' cs a'  cs a cs, a' |
        
        \barNumberCheck 41
        cs8[ a' cs a  cs,-. a'-.)-\slurShapeG ^( \voiceUp cs^. a'^.)] |
        \staffDown \oneVoice <e, a cs e>2.\fermata
      }
    }
  } 
  \fine
}

leftHand = \relative {
  \global
  \clef bass 
  \mergeDifferentlyDottedOn
  <<
    \new Voice \leftHandUpper
    \new Voice \leftHandLower
  >>
}

dynamics = {
  \override TextScript.Y-offset = -0.5
  \repeat volta 2 {
    \override DynamicLineSpanner.Y-offset = #1
    \partial 4 s8.\f-\tweak minimum-length #5 \< s16\! |
    s8\> s2..\! |
    s2. s8.-\tweak minimum-length #4 \< s16\! |
    s8\> s2..\! |
    s2.s4^\espressWO |
    s1*4 |
    
    \barNumberCheck 9
    s1-\tweak Y-offset #-3 \sf-\tweak Y-offset #-2.5 \> |
    s2 s4\!
  }
  \repeat volta 2 {
    s8.\f-\tweak minimum-length #5 \< s16\! |
    s4\> s2.\! |
    s8-\tweak Y-offset #1 \sf s2..-\tag midi \f |
    s1 |
    s2. s8\< s\! |
    s8\> s2..\! |
    s8\sf s4.-\tag midi \f s8 s4.\> |
    
    \barNumberCheck 17
    s4. s8\! s8 s4.\> |
    s4 s\! s\cresc s\< |
    s4. s8\! s4.\sf\> s8\! |
    s2..\< s8\! |
    s4\sf\> s2.\! |
    \override DynamicLineSpanner.Y-offset = #-0
    s2. s8.\f-\tweak minimum-length #5 \< s16\! |
    s8\> s2..\! |
    s2. s8.-\tweak Y-offset #1 \f-\tweak minimum-length #5
      -\tweak Y-offset #1.5 \< s16\! |
    
    \barNumberCheck 25
    s8-\tweak Y-offset #1.5 \> s4.\! s8 s4-\tweak Y-offset #1.5 \< s8\! |
    s8 s4.\! s s8\< |
    s2.. s8\! |
    s2..-\tweak Y-offset #-2 \sf-\tweak Y-offset #-1.5 \> s8\! |
    \alternative {
      { 
        s4-\tweak Y-offset #0.5 \> s2.\! |
        s2. 
      }
      {  
        s2\sf\> s\! |
        s4\> s\! s\> s\! |
        s2\f\> s\! |
        
        \barNumberCheck 33
        s1 |
        s4 s2\< s8 s\! |
        s2..\< s8\! |
        s2\f s\f\> |
        s8\! s4. s4.\< s8\! |
        s2\sf s\> |
        s2.. s8\! |
        s1-\tweak Y-offset #-2 \p |
        
        \barNumberCheck 41
        s1 |
        s2-\tweak Y-offset #1 -\tweak minimum-length #5 \> s4\!
      }
    }
  }
}

tempi = {
  \set Score.tempoHideNote = ##t
  \repeat volta 2 {
    \tempo "Allegro non assai, ma molto appassionato" 2 = 108
    \partial 4 s4
    s1*8 |
    
    \barNumberCheck 9
    \tempo 2 = 100 s2 \tempo 2 = 92 s |
    \tempo 2 = 84 s2.
  }
  \repeat volta 2 {
    \tempo 2 = 108
    s4 |
    s1*6 |
    
    \barNumberCheck 17
    s1*8 |
    
    \barNumberCheck 25
    s1*4 |
    \alternative {
      {
        \tempo 2 = 100 s2 \tempo 2 = 92 s |
        \tempo 2 = 84 s2.
      }
      {  
        s1*3 |
        
        \barNumberCheck 33
        s1*7 |
        s2 \tempo 2 = 100 s |
        
        \barNumberCheck 41
        \tempo 2 = 92 s2 \tempo 2 = 84 s |
        \tempo 2 = 60 s2.
      }
    }
  }
}

pedal = {
  \repeat volta 2 {
    \partial 4 s4\sd |
    s2. s4-\tag layout \sd -\tag midi \sud |
    s1 |
    s2.-\tweak Y-offset #-3 \sud s4-\tag layout \sd -\tag midi \sud |
    s1 |
    s2.-\tweak Y-offset #-2 \sud s4\su |
    s2-\tweak Y-offset #-3 \sd s4\su s\sd |
    s2-\tweak Y-offset #-2 -\tag layout \sd -\tag midi \sud s\su |
    s2\sd s-\tag layout \sd -\tag midi \sud |
    
    \barNumberCheck 9
    s1-\tag layout \sd -\tag midi \sud |
    s2-\tag layout \sd -\tag midi \sud s4-\tweak Y-offset #1 \sd
  }
  \repeat volta 2 {
    s4 |
    s2.\sud s4-\tweak Y-offset #2 \su |
    s2..-\tweak Y-offset #3 \sd s8\su |
    s2\sd s8\su s4.\sd |
    s2 s\su |
    s2.-\tweak Y-offset #2 \sd s4-\tweak Y-offset #2 \su |
    s2..\sd s8\su |
    
    \barNumberCheck 17
    s2\sd s-\tag layout \sd -\tag midi \sud |
    s2-\tag layout \sd -\tag midi \sud s-\tag layout \sd -\tag midi \sud |
    s2-\tag layout \sd -\tag midi \sud s-\tag layout \sd -\tag midi \sud |
    s2-\tag layout \sd -\tag midi \sud s-\tag layout \sd -\tag midi \sud |
    s2. s4-\tweak Y-offset #1 -\tag layout \sd -\tag midi \sud |
    s1 |
    s1-\tweak Y-offset #-5 -\tag layout \sd -\tag midi \sud |
    s2 s8 s4.-\tweak Y-offset #1 \su |
    
    \barNumberCheck 25
    s2-\tweak Y-offset #-2 \sd s4.-\tag layout \sd -\tag midi \sud s8\su |
    s2\sd s4.-\tag layout \sd -\tag midi \sud s8\su |
    s4.\sd s8\su s2\sd |
    s2-\tweak Y-offset #-2 -\tag layout \sd -\tag midi \sud
      s-\tweak Y-offset #-2 \su |
    \alternative {
      { 
        s1\sd |
        s2-\tag layout \sd -\tag midi \sud s4-\tag layout \sd -\tag midi \sud 
      }
      { 
        s2-\tweak Y-offset #-2 \sd s-\tweak Y-offset #-2 \su |
        s1*2 |
        
        \barNumberCheck 33
        s1*5 |
        s1-\tweak Y-offset #-2 \sd |
        s2 s-\tag layout \sd -\tag midi \sud |
        s1-\tweak Y-offset #-3 -\tag layout \sd -\tag midi \sud |
        
        \barNumberCheck 41
        s2. s4\sud |
        s2. 
      }
    }
  }
}

forceBreaks = {
  % page 1
  s4 s1*3 \break
  s1*4 \break
  s1*4 \break
  s1*4 \break
  s1*4 \pageBreak
  
  % page 2
  s1*4 \break
  s1*5 \break
  s1 s2. s1*3 \break
  s1*5 \break
}

intermezzoOneNotes =
\score {
  \header {
    title = "Intermezzo"
    composer = "Johannes Brahms"
    opus = "Opus 118, No.1"
  }
  \keepWithTag layout  
  \new PianoStaff \with {
    \override StaffGrouper.staff-staff-spacing = 
      #'((basic-distance . 10)
         (padding . 1))
  } <<
    \new Staff = "upper" \rightHand
    \new Dynamics \dynamics
    \new Staff = "lower" \leftHand
    \new Dynamics \pedal
    \new Dynamics \tempi
    \new Devnull \forceBreaks
  >>
  \layout {}
}

\include "articulate.ly"

intermezzoOneMidi =
\book {
  \bookOutputName "intermezzo-op118-no1"
  \score {
    \keepWithTag midi
    \articulate <<
      \new Staff = "upper" << \rightHand \dynamics \pedal \tempi >>
      \new Staff = "lower" << \leftHand \dynamics \pedal \tempi >>
    >>
    \midi {}
  }
}
