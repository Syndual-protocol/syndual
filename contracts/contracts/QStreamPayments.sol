// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract QStreamPayments {
    IERC20 public immutable token;

    struct Stream {
        address from;
        address to;
        uint128 ratePerSecond;
        uint64 start;
        uint64 end;
    }

    Stream[] public streams;
    mapping(uint256 => uint256) public withdrawn; // streamId => amount already withdrawn

    event StreamCreated(uint256 indexed streamId, address indexed from, address indexed to, uint128 ratePerSecond, uint64 start, uint64 end);
    event Withdrawn(uint256 indexed streamId, address indexed to, uint256 amount);

    constructor(IERC20 token_) {
        token = token_;
    }

    function createStream(address to, uint128 ratePerSecond, uint64 start, uint64 end) external returns (uint256) {
        require(to != address(0), "invalid recipient");
        require(ratePerSecond > 0, "rate zero");
        require(end > start, "invalid time");

        streams.push(Stream({from: msg.sender, to: to, ratePerSecond: ratePerSecond, start: start, end: end}));
        uint256 streamId = streams.length - 1;

        emit StreamCreated(streamId, msg.sender, to, ratePerSecond, start, end);
        return streamId;
    }

    function getWithdrawable(uint256 streamId) public view returns (uint256) {
        require(streamId < streams.length, "invalid stream");
        Stream memory s = streams[streamId];
        if (block.timestamp <= s.start) {
            return 0;
        }

        uint256 effectiveEnd = block.timestamp < s.end ? block.timestamp : s.end;
        uint256 elapsed = effectiveEnd - s.start;
        uint256 totalOwed = elapsed * uint256(s.ratePerSecond);
        uint256 alreadyWithdrawn = withdrawn[streamId];
        if (totalOwed <= alreadyWithdrawn) {
            return 0;
        }
        return totalOwed - alreadyWithdrawn;
    }

    function withdraw(uint256 streamId) external {
        require(streamId < streams.length, "invalid stream");
        Stream memory s = streams[streamId];
        uint256 amount = getWithdrawable(streamId);
        require(amount > 0, "nothing to withdraw");
        require(token.allowance(s.from, address(this)) >= amount, "insufficient allowance");

        withdrawn[streamId] += amount;
        require(token.transferFrom(s.from, s.to, amount), "transfer failed");
        emit Withdrawn(streamId, s.to, amount);
    }
}
