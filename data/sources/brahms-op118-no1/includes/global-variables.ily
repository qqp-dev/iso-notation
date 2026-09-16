%...+....1....+....2....+....3....+....4....+....5....+....6....+....7....+....
\version "2.24"

%
% Scheme functions
%

#(define (expect-warning-times n . arg)
   (for-each (lambda _ (apply ly:expect-warning arg))
             (iota n)))

makeSpanner = 
#(define-music-function (mrkup) (markup?)
  #{
    \tweak bound-details.left.text \markup \large #mrkup
    \tweak bound-details.left.stencil-align-dir-y #0
    \tweak bound-details.left-broken.text ##f
    \startTextSpan
  #})
%% Usage:
% rall = \makeSpanner \markup \large #"rall. "
% stopRall = \stopTextSpan
% \relative {
%   c'4 c c_\rall c \break |
%   c4 c\stopRall c c |
% }

dimRitSpanner = \makeSpanner \markup \large \italic "dim. rit. "
ritSpanner = \makeSpanner \markup \large \italic "rit. "
stopRit = \stopTextSpan

rf = #(make-dynamic-script "rf")

pocoCrescMarkup = 
  \markup \large \italic \whiteout \pad-markup #0.25 "poco cresc."
pocoCresc =
  #(make-music 'CrescendoEvent 'span-direction START 'span-type 'text
               'span-text pocoCrescMarkup)
  
crescSempreMarkup = 
  \markup \large \italic \left-column { cresc. sempre }
crescSempre =
  #(make-music 'CrescendoEvent 'span-direction START 'span-type 'text
               'span-text crescSempreMarkup)
  
% dimRitMarkup = \markup \large \italic "dim.rit."
% dimRit =
%   #(make-music 'DecrescendoEvent 'span-direction START 'span-type 'text
%                'span-text dimRitMarkup)

addArticulation =
#(define-music-function (articul music) (symbol? ly:music?)
   (for-some-music
     (lambda (m)
       (if (or (music-is-of-type? m 'note-event)
               (music-is-of-type? m 'event-chord))
           (begin
             (ly:music-set-property!
               m
               'articulations
               (cons
                 (make-music 'ArticulationEvent 'articulation-type articul)
                 (ly:music-property m 'articulations)))
             #t)
           #f))
     music)
   music)
%% Usage:
% \addArticulation #'staccato { c' d' <e' f'> }

addStaccato =
#(define-music-function (music) (ly:music?)
  (addArticulation 'staccato music)) 
%% Usage:
% \addStaccato { c' d' <e' f'> }

% Offset slur positions
osp =
#(define-music-function (offsets) (number-pair?)
  #{
     \once \override Slur.control-points =
       #(lambda (grob)
          (match-let ((((_ . y1) _ _ (_ . y2))
                       (ly:slur::calc-control-points grob))
                      ((off1 . off2) offsets))
            (set! (ly:grob-property grob 'positions)
                  (cons (+ y1 off1) (+ y2 off2)))
            (ly:slur::calc-control-points grob)))
  #})
%% Usage:
%
% \relative c'' {
%   \osp #'(0 . 2)
%   c4( c, d2)
% }

staffStaffSpacing = 
#(define-music-function (off dist) (number? number?)
   #{
      \once \override
        Score
        .NonMusicalPaperColumn
        .line-break-system-details
        = #`((Y-offset . ,off)
             (alignment-distances . (,dist)))
   #})

%
% Redefine
%

staffUp   = \change Staff = "upper"
staffDown = \change Staff = "lower"

voiceUp = {
  \change Staff = "upper"
  \voiceFour 
}
voiceDown = {
  \change Staff = "lower"
  \voiceThree 
}

sd  = \sustainOn
su  = \sustainOff
sud = \sustainOff\sustainOn

hideNoteHeads = {
  \omit Stem
  \omit Dots
  \omit Flag
  \hideNotes
  \override NoteColumn.ignore-collision = ##t
}

hideNoteHeadsOff = {
  \undo \omit Stem
  \undo \omit Dots
  \undo \omit Flag
  \unHideNotes
  \revert NoteColumn.ignore-collision
}

hideNoteHead = \once \hideNoteHeads

tupletOff = {
  \omit TupletBracket
  \omit TupletNumber
}
tupletOn = {
  \undo \omit TupletBracket
  \undo \omit TupletNumber
}

groupSixteenths.22 = \set Staff.beamExceptions = \beamExceptions { 
  16[ 16 16 16] 16[ 16 16 16] 16[ 16 16 16] 16[ 16 16 16] 
}
groupThirtysecondths.38 = \set Staff.beamExceptions = \beamExceptions {
  32[ 32 32 32] 32[ 32 32 32] 32[ 32 32 32]
}

unsetGrouping = \unset Staff.beamExceptions

trillFlat = \markup \tiny \concat { " " \flat }
% trillSharp = \markup \teeny \concat { " " \sharp }
insideSlur = \tweak avoid-slur #'inside \etc
trillBelow = \tweak Script.script-priority -100 \etc
% trillAbove = \tweak outside-staff-priority #9999 \etc
% noPriority = \tweak outside-staff-priority ##f \etc

crossStaffBracket = 
  \override PianoStaff.Arpeggio.stencil = #ly:arpeggio::brew-chord-bracket
  
tieShapeDone = \once \override TieColumn.positioning-done = ##t

%
% Markup
%

md = \markup \italic \halign #-0.2 m.d.
% ms = \markup \italic \halign #-0.4 m.s.
% conAnima = \markup \large \italic "con anima"
crescAnimato = \markup \large \italic "cresc., un poco animato"
crescMU = \markup \large \italic cresc.
% unPocoAnimato = \markup \large \italic "un poco animato"
pocoSosten = \markup \large \italic "poco sosten."
pocoAPocoAccel = \markup \large \italic "poco     a     poco     accel."
pedSimile = \markup \large \italic "Ped. simile"
senzaPed = \markup \large \italic "senza Ped."
% sotoVoce = \markup \large \italic "soto voce"
dolce = \markup \large \italic dolce
dolceWO = \markup \large \italic \whiteout \pad-markup #0.25 dolce
legato = \markup \large \italic legato
calando = \markup \large \italic calando
% risoluto = \markup \large \italic risoluto
% slentando = \markup \large \italic slentando
espressWO = \markup \large \italic \whiteout \pad-markup #0.25 espress.
espress = \markup \large \italic espress.
espressivoMU = \markup \large \italic \whiteout \pad-markup #0.25 espressivo
piuEspressivo = \markup \large \italic "più espressivo"
espr = \markup \large \italic espr.
dimRit = \markup \large \italic "dim. rit."
dimMolto = \markup \large \italic "dim. molto"
rit = \markup \large \italic rit.
ten = \markup \large \italic ten.
% pocoRiten = \markup \large \italic "poco riten."
piuLento = \markup \large \italic "più lento"
fPiuAgitato = \markup {
  \dynamic f \large \italic \whiteout \pad-markup #0.25 "più agitato"
}
% fEspress = \markup {
%   \dynamic f \large \italic \whiteout \pad-markup #0.25 espress.
% }
fEspressLegato = \markup {
  \dynamic f \large \italic \left-column { "espress." "legato" }
}
aTempo = \markup \large \italic "a tempo"
colPed = \markup \large \italic "col Ped."
piuPEDel = \markup { 
  \large \italic \whiteout \pad-markup #0.25 { 
    più \dynamic p \large \italic "e delicatamente"
  }
}
ppEDolceSempre = \markup { 
  \whiteout \pad-markup #0.25 { 
    \dynamic pp \large \italic "e dolce sempre"
  }
}
pDol = \markup { \dynamic p \large \italic dol. }
pDolce = \markup { \dynamic p \large \italic dolce }
pLeggiero = \markup { \dynamic p \large \italic leggiero }
pSottoVoce = \markup { \dynamic p \large \italic "sotto voce" }
dolente = \markup \large \italic dolente
perdendosi = \markup \large \italic perdendosi
moltoPEDolce = \markup { 
  \large \italic molto \dynamic p \large \italic "e dolce sempre"
}
fSempre = \markup { \dynamic f \large \italic sempre }
ppSempre = \markup { \dynamic pp \large \italic sempre }
semprePp = \markup { \large \italic sempre \dynamic pp }
sempreP = \markup { \large \italic sempre \dynamic p }
piuF = \markup { \large \italic più \dynamic f }
unaCordaMU = \markup \large \italic "una corda"
ppUnaCorda = \markup { \dynamic pp \large \italic "una corda" }
treCordeMU = \markup \large \italic "tre corde"
