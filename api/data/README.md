# Demo sample data

## `sample.csv`

Labeled email-spam features used by **Use Sample Email Spam Detection** on the live demo.

| | |
| :--- | :--- |
| **Source** | [UCI Spambase](https://archive.ics.uci.edu/dataset/94/spambase) (Hopkins, Reeber, Forman, Suermondt) |
| **Rows × cols** | 4,601 × 57 features + `class` |
| **Target** | `class`: `1` = spam, `0` = not spam |
| **License** | Public domain / freely redistributable (UCI Spambase) |
| **Use** | Workshop demo only, not a production spam filter |

Column names match the UCI Spambase attribute list (`word_freq_*`, `char_freq_*`, `capital_run_length_*`).
