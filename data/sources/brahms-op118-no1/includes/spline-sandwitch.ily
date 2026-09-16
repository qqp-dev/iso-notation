%%%%%%%%%%%%%%%%%%%%%%%%% Spline Slurs %%%%%%%%%%%%%%%%%%%%%%%%%
% This implements wavy slurs by using cubic natural splines.   %
% Control works by setting `details.anchor` points on certain  %
% grobs (note columns, heads, rests, stems, flags, beams),     %
% optionally also specifying a "parent-alignment" and a        %
% stiffness parameter.                                         %
%                                                              %
% Version: 2                                                   %
% Author: Tina Petzel                                          %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\version "2.24"

% This is a nice little helper function for reducing into a list
% i.e. not just accumulating values, but returning a list of all
% partial accumulates.
#(define (reduce-cumulative fn init . args)
   (if (any null? args) '()
       (let ((val (apply fn init (map car args))))
         (cons val (apply reduce-cumulative fn val (map cdr args))))))

% Like map, but apply function to argument
#(define (map-apply fn lst)
   (map (lambda (x) (apply fn x)) lst))

% Interpret a complex number a+bi as a linear polynomial a + bX and
% evaluate this at X=x.
#(define (eval-complex c x)
   (+ (real-part c) (* x (imag-part c))))

% Given a list of y-values calculate a list of Bezier-parameters giving
% a natural cubic spline. This assumes equally spaced X-values, but each y-value
% can also optionally give `(y . stiffness))` where `stiffness` controls effective
% x-scale on the segment starting on this y.
#(define (spline . ys)
   ; We need to calculate for each segment parameters alpha, beta, gamma, delta such that
   ; the spline conditions are fullfilled. Since our polynomials are parametrized as
   ; Bernstein basis alpha and delta are trivial: Alpha is the value at the left point, delta
   ; the value at the right. This means we need to find the betas and gammas such that
   ; first 2 derivatives are continuos and second derivative is 0 at start and end.
   ;
   ; This gives a simple linear recursion to get beta_i+1, gamma_i+1 from beta_i and gamma_i.
   ; But since solving 2nd derivative at left side = 0 leaves one parameter open we need to also
   ; solve for 2nd derivative at right side = 0.
   ;
   ; We do so by applying the recursion symbolically. Since this is linear this always remains of
   ; the shape A + B*free_par, so we can abuse complex data type for this by identifying
   ; i = free parameter.
   (let*
    ((stiffness (map (lambda (x) (if (pair? x) (cdr x) 1)) ys))
     (ys (map (lambda (x) (if (pair? x) (car x) x)) ys))
     (n (- (length ys) 2))
     (S (list->vector (map / stiffness (cdr stiffness)))) ; quotients of successive stiffness
     (ysv (list->vector ys))
     (beta0 0+1i) ; set beta_0 as free parameters
     (gamma0 (- (* 2 beta0) (vector-ref ysv 0))) ; solve for 2nd diff == 0 at (t = 0)
     (beta-gamma
      ; Recursively calculate betas and gammas (symbolically)
      (cons
       (cons beta0 gamma0)
       (reduce-cumulative
        (lambda (prev i)
          (cons (-
                 (* (1+ (vector-ref S (1- i))) (vector-ref ysv i))
                 (* (vector-ref S (1- i)) (cdr prev)))
                (+
                 (* (expt (vector-ref S (1- i)) 2) (car prev))
                 (* -2 (cdr prev) (+ (expt (vector-ref S (1- i)) 2) (vector-ref S (1- i))))
                 (* (vector-ref ysv i) (+ (expt (1+ (vector-ref S (1- i))) 2))))))
        (cons beta0 gamma0)
        (iota n 1))))
     (beta-gamma-n (list-ref beta-gamma n)) ; This is beta and gamma at the right side
     ; Solve for 2nd derivative at right side (at t = 1) is 0
     (eqn (+ (car beta-gamma-n) (* -2 (cdr beta-gamma-n)) (vector-ref ysv (1+ n))))
     (beta0-val (- (/ (real-part eqn) (imag-part eqn))))
     (beta0-val (if (nan? beta0-val) 0 beta0-val))
     ; Insert solution into symbolic values
     (beta-gamma-vals
      (map (lambda (beta-gamma)
             (cons (eval-complex (car beta-gamma) beta0-val)
                   (eval-complex (cdr beta-gamma) beta0-val)))
           beta-gamma))
     (alpha ys)
     (delta (cdr ys)))
    (map list alpha (map car beta-gamma-vals) (map cdr beta-gamma-vals) delta)))

% Print monomial-basis form from Bernstein-basis form
#(define (print-bpoly a b c d)
   (let ((0-coord a)
         (1-coord (+ (* -3 a) (* 3 b)))
         (2-coord (+ (* 3 a) (* -6 b) (* 3 c)))
         (3-coord (+ (* -1 a) (* 3 b) (* -3 c) d)))
     (format #f "~ax^3 + ~ax^2 + ~ax + ~a" 3-coord 2-coord 1-coord 0-coord)))

%#(display (string-join (map-apply print-bpoly (spline 0 1 2 3)) "\n"))
%#(display (spline 0 1 2))


% Make a closed path of sucessive order 3 bezier curves
#(define (make-path-sandwich-stencil coords thick)
   (define (iter p1 p2 p3 . rest)
     (cons*
      'curveto (car p1) (cdr p1) (car p2) (cdr p2) (car p3) (cdr p3)
      (if (null? rest) '() (apply iter rest))))
   (make-path-stencil
    (append
     (cons* 'moveto (caar coords) (cdar coords)
            (apply iter (cdr coords)))
     (list 'closepath))
    thick
    1
    1
    #t))

% Evaluate first derivative of Bernsteinbasis-representation at point t
#(define (bernstein-diff t a b c d)
   (let ((B0 (* -3 (expt (- 1 t) 2)))
         (B1 (* 3 (+ (* (- 1 t) (- 1 t)) (* t -2 (- 1 t)))))
         (B2 (* 3 (+ (* 2 t (- 1 t)) (* t t -1))))
         (B3 (* 3 t t)))
     (+ (* a B0) (* b B1) (* c B2) (* d B3))))

% Creates a spline curve from a list of input points
%
% control-points: A list of points (x . y) or ((x . stiffness_x) . (y . stiffness_y))
% thickness: Width of the path outline
% heightfn: A function that gives the local thickness of the curve at a point t in [0, 1]
%
% Creates a list of bezier control points and returns a make-path-sandwich-stencil
#(define (make-spline-bow-stencil control-points thickness heightfn)
   (let* ((control-points2
           (map
            (lambda (p1 p2)
              (let* ((p1-x (car p1))
                     (stiffness-x (if (pair? p1-x) (cdr p1-x) 1))
                     (p1-x (if (pair? p1-x) (car p1-x) p1-x))
                     (p1-y (cdr p1))
                     (stiffness-y (if (pair? p1-y) (cdr p1-y) 1))
                     (p1-y (if (pair? p1-y) (car p1-y) p1-y))
                     (p2-x (car p2))
                     (p2-x (if (pair? p2-x) (car p2-x) p2-x))
                     (p2-y (cdr p2))
                     (p2-y (if (pair? p2-y) (car p2-y) p2-y))
                     (abs (sqrt (+ (expt (- p1-x p2-x) 2) (expt (- p1-y p2-y) 2)))))
                (cons (cons p1-x (* stiffness-x abs))
                      (cons p1-y (* stiffness-y abs)))))
            control-points (append (cdr control-points) '((0 . 0)))))
          (bezier-x (apply spline (map car control-points)))
          (bezier-y (apply spline (map cdr control-points)))
          (norm
           (map
            (lambda (c1 c2)
              (let* ((xs (map (lambda (t) (apply bernstein-diff t c1)) '(0 1/3 2/3 1)))
                     (ys (map (lambda (t) (apply bernstein-diff t c2)) '(0 1/3 2/3 1)))
                     (abs (map (lambda (x y) (sqrt (+ (* x x) (* y y)))) xs ys)))
                (map
                 (lambda (x y a)
                   (cons (- (/ y a)) (/ x a)))
                 xs ys abs)))
            bezier-x bezier-y))
          (bezier-x-joined (cons (caar bezier-x) (apply append (map cdr bezier-x))))
          (bezier-y-joined (cons (caar bezier-y) (apply append (map cdr bezier-y))))
          (norm-joined (cons (caar norm) (apply append (map cdr norm))))
          (n (length norm-joined))
          (times (iota n 0 (/ 1 (1- n))))
          (heights (map (lambda (x) (/ x 2)) (map heightfn times)))
          (bezier-points (map cons bezier-x-joined bezier-y-joined))
          (bezier-points-up
           (map (lambda (p n h)
                  (cons (+ (car p) (* (car n) h))
                        (+ (cdr p) (* (cdr n) h))))
                bezier-points norm-joined heights))
          (bezier-points-down
           (map (lambda (p n h)
                  (cons (- (car p) (* (car n) h))
                        (- (cdr p) (* (cdr n) h))))
                bezier-points norm-joined heights)))
     (make-path-sandwich-stencil
      (append bezier-points (cdr (reverse bezier-points-down)))
      (* 2 thickness))))

% % Usage example
% \markup\stencil #(make-spline-bow-stencil '((0 . 0) (1 . 1) (2 . 1) (3 . 0) (4 . -1) (5 . -1) (6 . 0)) 0.1 (lambda (t) (* 0.24 (min 1 (* 4 t) (* 4 (- 1 t))))))

% Look for associated NoteColumns, NoteHeads, Rests, Stems, Beams, Flags with
% details.anchor set. This can be a single pair or a list of pairs for multiple anchors.
% You can also set details.anchor-alignment (a pair of numbers or list of pairs) to specicy
% for both X and Y how where to align the anchor to relative to the base grob extent (e.g.
% up or down the stem). You can also set details.stiffness (number or list of numbers).
% This specifies the stiffness of the section starting at this point. The higher the value is
% the flatter the segment will be.
#(define (slur::stencil-from-anchors grob)
   (define (has-anchor? grob)
       (and (ly:grob? grob) (assoc-get 'anchor (ly:grob-property grob 'details) #f) grob))
     (define (grob-list-from-grob-array x)
       (if (ly:grob-array? x) (ly:grob-array->list x) '()))
     (let* ((note-colums (ly:grob-array->list (ly:grob-object grob 'note-columns)))
            (system (ly:grob-system grob))
            (_ (ly:grob-set-parent! grob X system))
            (_ (if (ly:grob-property grob 'cross-staff #f) (ly:grob-set-parent! grob Y system)))
            (vag (ly:grob-parent grob Y))
            (anchors
             (map
              (lambda (column)
                ; A grob might specify multiple anchors, but only one grob related to
                ; this note column may specify an anchor. This is because else order is
                ; not well or arbitrarily defined.
                (set! column
                      (or
                       (has-anchor? column)
                       (has-anchor? (ly:grob-object column 'stem))
                       (has-anchor? (ly:grob-object column 'rest))
                       (any has-anchor? (grob-list-from-grob-array (ly:grob-object column 'note-heads)))
                       column))
                (let* ((det (ly:grob-property column 'details))
                       (anchor (assoc-get 'anchor det #f))
                       (anchor-alignment (assoc-get 'anchor-alignment det '(0 . 0)))
                       (stiffness (assoc-get 'stiffness det 1))
                       (ext-x (ly:grob-extent column system X))
                       (ext-y (ly:grob-extent column vag Y)))
                  (if (and anchor (not (list? anchor))) (set! anchor (list anchor)))
                  (if (and anchor (not (list? anchor-alignment)))
                      (set! anchor-alignment (make-list (length anchor) anchor-alignment)))
                  (if (and anchor (not (list? stiffness)))
                      (set! stiffness (make-list (length anchor) stiffness)))
                  (and
                   anchor
                   (map
                    (lambda (anchor anchor-alignment stiffness)
                     (let ((coords
                            (cons
                            (interval-index ext-x (car anchor-alignment))
                            (interval-index ext-y (cdr anchor-alignment)))))
                      (cons (cons (+ (car coords) (car anchor)) stiffness)
                            (cons (+ (cdr coords) (cdr anchor)) stiffness))))
                    anchor anchor-alignment stiffness))))
              note-colums))
            (anchors (apply append (filter (lambda (x) x) anchors))))
       (if (> (length anchors) 1)
           (make-spline-bow-stencil
            anchors
            0.001 (lambda (t) (* 0.26 (min 1 (* 8 t) (* 8 (- 1 t))))))
           (ly:slur::print grob))))

% % Usage example
% {
%   \once\override Slur.cross-staff = ##f
%   \once\override Slur.stencil = #slur::stencil-from-anchors
% 
%   \once\override NoteHead.details.anchor = #'(0 . -1)
%   c'8( d'
%   \once\override NoteHead.details.anchor = #'(0 . -3)
%   e' f'
%   \once\override NoteHead.details.anchor = #'(0 . -1)
%   g' f'
%   \once\override NoteHead.details.anchor = #'(0 . -2.3)
%   e'
%   \once\override NoteHead.details.anchor = #'(1 . -1)
%   d'
%   \once\override Stem.details.anchor = #'((-1 . 2) (0 . 1))
%   \once\override Stem.details.anchor-alignment = #'(0 . 1)
%   \once\override Stem.details.stiffness = #'(3 1)
%   c') c'( d' e' f')
% }
