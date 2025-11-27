# Q-Stream Micropayments

Q-Stream models continuous token flows using SyndualToken. A stream specifies a rate per second with start/end timestamps. Recipients can withdraw accrued amounts over time.

## Mechanics
- Streams track `from`, `to`, `ratePerSecond`, `start`, `end`.
- Withdrawable = ratePerSecond * elapsed time (bounded by end).
- Requires token allowance to the streaming contract.

## ZK Angle
- `qstream_settle.circom` demonstrates zk validation of the owed amount without revealing full stream details.
- Future work: batch settlements and privacy-preserving receivers.
