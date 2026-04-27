# LaTeX Math Rendering Test

## Inline Math

This is an inline equation: $E = mc^2$, and here's another: $a^2 + b^2 = c^2$.

The quadratic formula is $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$.

## Display Math (Block)

Here's a famous integral:

$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$

Matrix example:

$$
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
$$

## Your Table Example

| Method | Model | Check | Times | Score1 | Score2 | Score3 | Score4 | Score5 | Score6 | Score7 | Score8 | Score9 | Score10 |
|--------|-------|-------|-------|--------|--------|--------|--------|--------|--------|--------|--------|--------|---------|
| In-context RAG* | 1x | $\times$ | $\times$ | 44.69 | 38.07 | 41.27 | 37.14 | 20.11 | 16.78 | 41.02 | 38.51 | 36.77 | 32.62 |
| RECOMP* | 1x | $\checkmark$ | $\times$ | 42.67 | 37.47 | 42.72 | 38.72 | 24.96 | 17.34 | 38.26 | 32.17 | 37.15 | 31.43 |
| DPA-RAG* | 1x | $\checkmark$ | $\times$ | 44.31 | 37.29 | 40.53 | 37.15 | 20.36 | 18.45 | 39.66 | 39.02 | 36.22 | 32.98 |
| RetRobust* | 1x | $\times$ | $\checkmark$ | 43.82 | 37.03 | 40.54 | 35.59 | 18.16 | 18.11 | 39.11 | 38.65 | 35.41 | 32.34 |

## More Examples

Greek letters: $\alpha, \beta, \gamma, \Delta, \Omega$

Summation: $\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$

Limits: $\lim_{x \to \infty} \frac{1}{x} = 0$

Fractions and subscripts: $\frac{dy}{dx} = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}$
