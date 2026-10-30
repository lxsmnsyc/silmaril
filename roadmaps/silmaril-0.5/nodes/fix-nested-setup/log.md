# Log

- Wrote the nested $$ test first: 3 contexts instead of 2 on the base, test failed.
- Added a WeakSet of transformed call nodes to the plugin state; transformSetup returns early for a node it already handled.
