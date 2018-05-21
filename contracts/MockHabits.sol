pragma solidity 0.4.23;

import "./Habits.sol";


/**
 * @title Ether Habits Mock Class
 * @dev For debugging and testing only!! DO NOT DEPLOY
 */
contract MockHabits is Habits() {

    /**
     * @dev Return owner for testing
     * @return Address of owner
     */
    function getOwnerTestUtil() external view returns (address) {
        require(msg.sender == owner);
        return owner;
    }

    /**
     * @dev Return if admin
     * @param _user User to check if an admin or not
     * @return bool
     */
    function isAdminTestUtil(address _user) external view returns (bool) {
        require(msg.sender == owner);
        return adminPermission[_user];
    }

    /**
     * @dev Wrapper for getDate
     * @param _timestamp Timestamp (unix time) 
     * @return date (unix time)
     */
    function getDateTestUtil(uint32 _timestamp) external pure returns (uint32) {
        return getDate(_timestamp);
    }

    /**
     * @dev Wrapper for getNextDate
     * @param _timestamp Timestamp (unix time) 
     * @return date (unix time)
     */
    function getNextDateTestUtil(uint32 _timestamp) external pure returns (uint32) {
        return getNextDate(_timestamp);
    }

    /**
     * @dev Wrapper for getLastRegisterDate
     * @return date (unix time)
     */
    function getLastRegisterDateTestUtil() external view returns (uint32) {
        require(msg.sender == owner);
        return getLastRegisterDate();
    }

    /**
     * @dev Wrapper for calculateBonus
     * @param _date Date (unix time) to calculate bonus for
     * @return Bonus amount
     */
    function calculateBonusTestUtil(uint32 _date) external view returns (uint256) {
        require(msg.sender == owner);
        return calculateBonus(_date);
    }

    /**
     * @dev Wrapper for calculateOperationFee
     * @param _date Date (unix time) to calculate operation fee for
     * @return Operation fee amount
     */
    function calculateOperationFeeTestUtil(uint32 _date) external view returns (uint256) {
        require(msg.sender == owner);
        return calculateOperationFee(_date);
    }

    /**
     * @dev Test util method to manually set UserEntryStatus for a given user and date
     * @param _user User to set status for
     * @param _date Date (unix time) to set status for
     * @param _status UserEntryStatus
     */
    function setEntryStatusForUserDateTestUtil(address _user, uint32 _date, UserEntryStatus _status)
    external payable {
        require(msg.sender == owner);
        if (userDateToStatus[_user][_date] == UserEntryStatus.NULL) {
            userToDates[_user].push(_date);
            dateToUsers[_date].push(_user);
            dateToContestStatus[_date].numRegistered += 1;
        }
        if (_status == UserEntryStatus.COMPLETED) {
            dateToContestStatus[_date].numCompleted += 1;
        }
        userDateToStatus[_user][_date] = _status;
    }
}
