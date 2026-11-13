---
title: "ControlledShifts: Towards Standardizing Robustness Evaluation in Trajectory Prediction Under Distribution Shifts"
collection: publications
category: preprints
permalink: /publication/controlledshifts
date: 2026-08-18
venue_short: "arXiv 2026"
venue: "arXiv preprint arXiv:2608.17882"
authors: "I. Navarro, <b>P. Ortega-Kral</b>, Y. Duan, J. Francis, J. Oh"
excerpt: "Introduces a benchmark suite that re-splits existing driving datasets into seen and unseen partitions along three distribution-shift axes, with a unified robustness score that compares trajectory predictors on prediction quality and stability."
img: "/images/publications/controlledshifts_overview.png"
alt: "ControlledShifts overview"
width: '35%'
pdf: "https://arxiv.org/abs/2608.17882"
page: "https://navars.xyz/controlledshifts/"
abstract: "Trajectory prediction is central to safety in autonomous driving, yet learning-based predictors tend to degrade sharply when encountering scenarios poorly represented by their training data. Many methods attempt to mitigate distribution shift degradation through data-centric or test-time adaptation approaches; however, they are typically validated along fragmented axes of generalization, leaving the field without a standardized way to compare robustness across shifts a model may encounter. To address this, we introduce ControlledShifts, a framework and benchmark suite that systematically re-splits existing trajectory datasets into in-distribution (seen) and out-of-distribution (unseen) partitions, via a shared characterization-and-splitting formulation, in which a characterization function fixes the axis of variation a benchmark probes and a splitting function fixes how the tail of that axis is withheld. The suite comprises three benchmarks targeting key topological and behavioral distribution shifts. Furthermore, to aggregate multi-dimensional performance metrics across these benchmarks, we propose a unified robustness score that evaluates models along two complementary dimensions: prediction quality (relative performance gain) and prediction stability (performance preservation under shift). We showcase ControlledShifts by benchmarking prominent transformer-based architectures, exposing critical differences in how models of varying capacities handle latent relevance and environmental structure."
---

![ControlledShifts overview](/images/publications/controlledshifts_overview.png)

I. Navarro, <b>P. Ortega-Kral</b>, Y. Duan, J. Francis, J. Oh

[Paper](https://arxiv.org/abs/2608.17882){: .pub-link} [Project page](https://navars.xyz/controlledshifts/){: .pub-link}
{: .pub-links}

Introduces a benchmark suite that re-splits existing driving datasets into seen and unseen partitions along three distribution-shift axes, with a unified robustness score that compares trajectory predictors on prediction quality and stability.
