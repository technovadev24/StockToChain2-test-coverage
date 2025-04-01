// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../interfaces/AggregatorV3Interface.sol";

contract MockV3Aggregator is AggregatorV3Interface {
    uint8 private _decimals;
    int256 private _latestAnswer;
    uint256 private _latestTimestamp;
    uint256 private _latestRound;

    constructor(uint8 decimals_, int256 initialAnswer) {
        _decimals = decimals_;
        _latestAnswer = initialAnswer;
        _latestTimestamp = block.timestamp;
        _latestRound = 1;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function description() external pure override returns (string memory) {
        return "Mock V3 Aggregator";
    }

    function version() external pure override returns (uint256) {
        return 3;
    }

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _roundId,
            _latestAnswer,
            _latestTimestamp,
            _latestTimestamp,
            _roundId
        );
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            uint80(_latestRound),
            _latestAnswer,
            _latestTimestamp,
            _latestTimestamp,
            uint80(_latestRound)
        );
    }

    function updateAnswer(int256 newAnswer) external {
        _latestAnswer = newAnswer;
        _latestTimestamp = block.timestamp;
        _latestRound++;
    }
} 