# Learning Pleasant Diagram Layouts with Machine Learning

**Research date:** September 23, 2026  
**Scope:** Learned diagram layout generation, human aesthetic preference modeling, and applicability to Axonize's editable diagrams.

There is research on both generating layouts with machine learning and learning what people find visually pleasant. These are distinct capabilities: many neural layout generators still optimize hand-written metrics such as crossings and spacing. A model that predicts human preference can help choose or improve layouts, but does not necessarily generate positions itself.

The useful distinction is between learned layout decisions and hand-designed layout rules. Determinism alone does not distinguish them: a trained model can produce deterministic outputs at inference time.

| Work | What it learns | Relevance to pleasant layout |
| --- | --- | --- |
| **[Beauty in the Eye of AI: Aligning LLMs and Vision Models with Human Aesthetics in Network Visualization](https://doi.org/10.1111/cgf.70456), 2026** | Vision models and LLM-based methods predict people's preferred graph layouts. The study collected approximately **64,000 judgments across 11,531 graphs**, from 27 participants. | The closest match to learning aesthetic taste directly. Evaluates and selects existing layouts; does not itself generate node positions. |
| **[A Machine Learning Approach for Predicting Human Preference for Graph Layouts](https://jgaa.info/index.php/jgaa/article/view/paper603), 2022** | A Siamese CNN compares images of two layouts. It is pretrained using aesthetic metrics, then fine-tuned on actual human preferences. | A learned answer to “which arrangement looks better?” Reports **92.28% accuracy on its large scale-free and mesh graph test setting**, rather than a general diagram benchmark. |
| **[SmartGD: A GAN-Based Graph Drawing Framework for Diverse Aesthetic Goals](https://arxiv.org/abs/2206.06434), 2024 journal publication** | A generator produces layouts while a discriminator learns from examples of good drawings. Supports objectives that are not differentiable. | A relevant starting point for an actual learned layout engine. Published experiments select good examples using conventional metrics; learning human taste is a proposed extension. The preprint first appeared in 2022. |
| **[DeepGD: A Deep Learning Framework for Graph Drawing Using GNN](https://arxiv.org/abs/2106.15347), 2021** | A graph neural network generates layouts, balancing multiple aesthetic objectives. | ML layout generation, but pleasantness remains defined through predetermined metrics. |
| **[Evaluating the Layout Quality of UML Class Diagrams Using Machine Learning](https://doi.org/10.1016/j.jss.2022.111413), 2022** | Regression models predict expert quality ratings from image-derived features, using **609 manually rated UML diagrams**. | Particularly relevant to labeled boxes and connectors. Assesses layouts rather than producing them. |

The **Beauty in the Eye of AI** paper provides useful evidence about both feasibility and limits. Its trained vision model agreed with human choices **36.81%** of the time, compared with **38.34% agreement between humans**, when choosing among eight alternatives. These results support learning shared preferences while showing substantial variation in taste. They should not be compared directly with the 92.28% figure from the earlier pairwise study: the tasks and datasets differ. Orthogonal and hierarchical layouts remain future work in the 2026 study. [Paper](https://doi.org/10.1111/cgf.70456)

For richer, editable diagrams, newer work explores generation and iterative visual refinement:

- **[See it. Say it. Sorted: Agentic System for Compositional Diagram Generation](https://arxiv.org/abs/2508.15222), 2025 preprint.** Converts sketches into editable SVG through a loop of visual critique, candidate edits, and judging. Uses pretrained models without additional training. Relevant to visual refinement, although evaluated on only **10 sketches**. [Source code](https://github.com/hantaoZhangrichard/see_it_say_it_sorted)
- **[EvoDiagram: Agentic Editable Diagram Creation via Design Expertise Evolution](https://arxiv.org/abs/2604.09568), 2026 preprint.** Coordinates structure, styling, and layout through an editable canvas representation, accumulating design knowledge from execution traces. Closer to complete diagram composition than abstract graph drawing. Its design knowledge mechanism should be distinguished from training a dedicated layout network on human preference labels.
- **[GeoSVG-RL: Geometry-Aware Reinforcement Learning for Layout-Constrained Text-to-SVG Diagram Generation](https://arxiv.org/abs/2605.25447), 2026 preprint.** Trains diagram generation with reinforcement learning and executable checks for connector anchors, text containment, canvas bounds, and connectivity. Relevant to reliable geometry; its reward does not directly capture human aesthetic preference.

**Assessment for Axonize:** SmartGD plus the human-preference papers provide a promising foundation for learning an arrangement and judging its visual quality. This is an engineering assessment based on the research, not a demonstrated end-to-end solution for Axonize's diagram types. Transferring these methods to boxes, labels, ports, nested groups, and routed arrows would require domain-specific data and evaluation.

An experiment should distinguish three outcomes: whether the model generates valid geometry, whether people prefer the result, and whether people can understand the diagram more easily. The cited preference results establish evidence about visual choice within their evaluated settings; they do not establish all three outcomes for technical diagrams.

Runnable research implementations are available:

| Implementation | Available starting point | Limitation |
| --- | --- | --- |
| **[SmartGD source code](https://github.com/yolandalalala/SmartGD)** | Demo notebook and pretrained stress-minimization and crossing-minimization models. | The supplied checkpoints learn conventional objectives rather than human taste. |
| **[DeepGD source code](https://github.com/yolandalalala/DeepGD)** | Demo notebook and a stress-minimization checkpoint. | Useful for experimenting with learned graph layout; not a pretrained aesthetic preference model for labeled technical diagrams. |

This note complements the existing [human-friendly Mermaid layout research](mermaid_human_friendly_graph_drawing_research.md), with a specific focus on learned generation and preference modeling.
