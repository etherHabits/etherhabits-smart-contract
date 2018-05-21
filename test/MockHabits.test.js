import assertRevert from "openzeppelin-solidity/test/helpers/assertRevert";

var MockHabits = artifacts.require("./MockHabits.sol");

contract("Habits", (accounts) => {
  let habits;
  let habitsAddress;

  const DAY = 86400;
  const ENTRY_FEE = 0.005;
  const GAS_BUFFER = web3.toWei(ENTRY_FEE * 1.2, "ether");
  const NUM_REGISTER_DAYS = 10;
  const ENTRY_FEE_WEI = web3.toWei(ENTRY_FEE, "ether");
  const DEFAULT_ENTRY_FEE_WEI = web3.toWei(ENTRY_FEE * NUM_REGISTER_DAYS, "ether");
  const TODAY = getTodayDate();
  const YESTERDAY = TODAY - DAY;
  const TWO_DAYS_AGO = TODAY - DAY * 2;
  const THREE_DAYS_AGO = TODAY - DAY * 3;
  const FOUR_DAYS_AGO = TODAY - DAY * 4;
  const FIVE_DAYS_AGO = TODAY - DAY * 5;
  const TOMORROW = TODAY + DAY;
  const WEB3_GAS_MAX = 4700000;
  const EntryStatus = Object.freeze({
    NULL: 0,
    REGISTERED: 1,
    COMPLETED: 2,
    WITHDRAWN: 3
  });

  function getTodayDate() {
    var now = Math.floor(Date.now() / 1000)
    return now - now % DAY;
  }

  function compareArray(a, b) {
    assert.equal(a.length, b.length);
    for (var i in a) {
      assert.equal(a[i], b[i]);
    }
  }

  beforeEach(async () => {
    habits = await MockHabits.new();
    habitsAddress = await habits.address;
  });

  describe("Contract Creation", () => {
    it("should set the owner correctly", async () => {
      // account0 should be owner and admin
      let owner = await habits.getOwnerTestUtil();
      assert.equal(owner, accounts[0]);
      let isAdmin = await habits.isAdminTestUtil(accounts[0]);
      assert.isOk(isAdmin);

      // make sure account1 is not admin
      isAdmin = await habits.isAdminTestUtil(accounts[1]);
      assert.isNotOk(isAdmin);
    });
  });

  describe("Register", () => {
    it("should register a user for ten days", async () => {
      await habits.register(TOMORROW, {from: accounts[0], value: DEFAULT_ENTRY_FEE_WEI});
      let registeredDates = await habits.getDatesForUser(accounts[0], {from: accounts[0]});
      let expectedDates = [
        TODAY + 1 * DAY, TODAY + 2 * DAY, TODAY + 3 * DAY, TODAY + 4 * DAY, TODAY + 5 * DAY,
        TODAY + 6 * DAY, TODAY + 7 * DAY, TODAY + 8 * DAY, TODAY + 9 * DAY, TODAY + 10 * DAY
      ];
      compareArray(registeredDates, expectedDates);

      for (var i in expectedDates) {
        var status = await habits.getEntryStatus(accounts[0], expectedDates[i], {from: accounts[0]});
        assert.equal(status.toNumber(), EntryStatus.REGISTERED);

        var users = await habits.getUsersForDate(expectedDates[i], {from: accounts[0]});
        compareArray(users, [accounts[0]]);

        let contestStatus = await habits.getContestStatusForDateAdmin(expectedDates[i]);
        assert.equal(contestStatus[0], 1);  // numRegistered
        assert.equal(contestStatus[1], 0);  // numCompleted
        assert.equal(contestStatus[2], false);  // operationFeeWithdrawn
      }

      // check address balance
      assert.equal(web3.eth.getBalance(habitsAddress), DEFAULT_ENTRY_FEE_WEI);
    });

    it("should register multiple user for ten days", async () => {
      await habits.register(TOMORROW, {from: accounts[0], value: DEFAULT_ENTRY_FEE_WEI});
      await habits.register(TOMORROW, {from: accounts[1], value: DEFAULT_ENTRY_FEE_WEI});
      await habits.register(TOMORROW, {from: accounts[2], value: DEFAULT_ENTRY_FEE_WEI});

      // spot check for accounts[1]
      let registeredDates = await habits.getDatesForUser(accounts[1], {from: accounts[0]});
      let expectedDates = [
        TODAY + 1 * DAY, TODAY + 2 * DAY, TODAY + 3 * DAY, TODAY + 4 * DAY, TODAY + 5 * DAY,
        TODAY + 6 * DAY, TODAY + 7 * DAY, TODAY + 8 * DAY, TODAY + 9 * DAY, TODAY + 10 * DAY
      ];
      compareArray(registeredDates, expectedDates);

      for (var i in expectedDates) {
        var status = await habits.getEntryStatus(accounts[1], expectedDates[i], {from: accounts[0]});
        assert.equal(status.toNumber(), EntryStatus.REGISTERED);

        var users = await habits.getUsersForDate(expectedDates[i], {from: accounts[0]});
        compareArray(users, [accounts[0], accounts[1], accounts[2]]);

        let contestStatus = await habits.getContestStatusForDateAdmin(expectedDates[i]);
        assert.equal(contestStatus[0], 3);  // numRegistered
        assert.equal(contestStatus[1], 0);  // numCompleted
        assert.equal(contestStatus[2], false);  // operationFeeWithdrawn
      }

      // check address balance
      assert.equal(web3.eth.getBalance(habitsAddress), DEFAULT_ENTRY_FEE_WEI * 3);
    });

    // testing register when some days have already been registered
    it("should register a user for the next 10 days after last registered date", async () => {
      for (var i = 1; i <= 5; i++) {
        await habits.setEntryStatusForUserDateTestUtil(
          accounts[0],
          TODAY + i * DAY,
          EntryStatus.REGISTERED,
          {value: ENTRY_FEE_WEI}
        );
      }
      await habits.register(TODAY + 6 * DAY, {from: accounts[0], value: DEFAULT_ENTRY_FEE_WEI});

      let registeredDates = await habits.getDatesForUser(accounts[0], {from: accounts[0]});
      let expectedDates = [
        TODAY + 1 * DAY, TODAY + 2 * DAY, TODAY + 3 * DAY, TODAY + 4 * DAY, TODAY + 5 * DAY,
        TODAY + 6 * DAY, TODAY + 7 * DAY, TODAY + 8 * DAY, TODAY + 9 * DAY, TODAY + 10 * DAY,
        TODAY + 11 * DAY, TODAY + 12 * DAY, TODAY + 13 * DAY, TODAY + 14 * DAY, TODAY + 15 * DAY
      ];
      compareArray(registeredDates, expectedDates);

      for (var i in expectedDates) {
        var status = await habits.getEntryStatus(accounts[0], expectedDates[i], {from: accounts[0]});
        assert.equal(status.toNumber(), EntryStatus.REGISTERED);

        var users = await habits.getUsersForDate(expectedDates[i], {from: accounts[0]});
        compareArray(users, [accounts[0]]);

        let contestStatus = await habits.getContestStatusForDateAdmin(expectedDates[i]);
        assert.equal(contestStatus[0], 1);  // numRegistered
        assert.equal(contestStatus[1], 0);  // numCompleted
        assert.equal(contestStatus[2], false);  // operationFeeWithdrawn
      }

      // check address balance
      assert.equal(web3.eth.getBalance(habitsAddress), web3.toWei(ENTRY_FEE * 15, "ether"));
    });

    it("should fail if entry fee is too small", async () => {
      assertRevert(
        habits.register(TOMORROW, {
          from: accounts[0],
          value: web3.toWei("49999999999999999", "wei")
        })
      );
    });

    it("should fail if entry fee is too large", async () => {
      assertRevert(
        habits.register(TOMORROW, {
          from: accounts[0],
          value: web3.toWei("50000000000000001", "wei")
        })
      );
    });

    it("should fail if expected start day does not match", async () => {
      assertRevert(
        habits.register(TODAY, {from: accounts[0], value: DEFAULT_ENTRY_FEE_WEI})
      );
    });

    it("should fail if trying to register more than 90 days in advance", async () => {
      for (var i = 0; i < 9; i++) {
        await habits.register(
          TOMORROW + i * 10 * DAY,
          {from: accounts[0], value: DEFAULT_ENTRY_FEE_WEI}
        )
      }
      assertRevert(
        habits.register(
          TOMORROW + 90 * DAY, {from: accounts[0], value: DEFAULT_ENTRY_FEE_WEI}
        )
      );
    });

    it("should succeed if only 90 days in advance", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0],
        TODAY + 89 * DAY,
        EntryStatus.REGISTERED
      );

      await habits.register(
        TODAY + 90 * DAY,
        {from: accounts[0], value: DEFAULT_ENTRY_FEE_WEI}
      );

      let lastDate = await habits.getLastRegisterDateTestUtil();
      assert.equal(lastDate.toNumber(), TODAY + 99 * DAY);
    });

    it("should fail if 91 days in adavance", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0],
        TODAY + 90 * DAY,
        EntryStatus.REGISTERED
      );

      assertRevert(
        habits.register(
          TODAY + 91 * DAY,
          {from: accounts[0], value: DEFAULT_ENTRY_FEE_WEI}
        )
      );
    });

    it("should fail if trying to submit same transaction twice", async () => {
      await habits.register(TOMORROW, {from: accounts[0], value: DEFAULT_ENTRY_FEE_WEI});
      assertRevert(
        habits.register(TOMORROW, {from: accounts[0], value: DEFAULT_ENTRY_FEE_WEI})
      );
    });
  });

  describe("Check In", () => {
    it("should successfully check-in", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TODAY, EntryStatus.REGISTERED
      );
      await habits.checkIn({ from: accounts[0] });
      var status = await habits.getEntryStatus(accounts[0], TODAY, {from: accounts[0]});
      assert.equal(status.toNumber(), EntryStatus.COMPLETED);
    });

    it("should not be able to check-in if not registered", async () => {
      var status = await habits.getEntryStatus(accounts[0], TODAY, {from: accounts[0]});
      assert.equal(status, EntryStatus.NULL);
      assertRevert(habits.checkIn({ from: accounts[0] }));
    });

    it("should not be able to check-in if already completed", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TODAY, EntryStatus.COMPLETED
      );
      var status = await habits.getEntryStatus(accounts[0], TODAY, {from: accounts[0]});
      assert.equal(status.toNumber(), EntryStatus.COMPLETED);
      assertRevert(habits.checkIn({ from: accounts[0] }));
    });

    it("should not be able to check-in if already withdrawn", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TODAY, EntryStatus.WITHDRAWN
      );
      var status = await habits.getEntryStatus(accounts[0], TODAY, {from: accounts[0]});
      assert.equal(status.toNumber(), EntryStatus.WITHDRAWN);
      assertRevert(habits.checkIn({ from: accounts[0] }));
    });

    it("should not be able to complete if not today", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], YESTERDAY, EntryStatus.REGISTERED
      );
      var status = await habits.getEntryStatus(accounts[0], YESTERDAY, {from: accounts[0]});
      assert.equal(status.toNumber(), EntryStatus.REGISTERED);
      assertRevert(habits.checkIn({ from: accounts[0] }));
    });
  });

  describe("Withdraw", () => {

    it("should be able to withdraw deposit from two days ago", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TWO_DAYS_AGO, EntryStatus.COMPLETED, {value: ENTRY_FEE_WEI}
      );

      // pre calculate withdraw amount and dates
      let preCalculatedWithdrawAmount = await habits.calculateWithdrawableAmount({from: accounts[0]});
      assert.equal(preCalculatedWithdrawAmount, ENTRY_FEE_WEI);
      let preCalculatedWithdrawDates = await habits.getWithdrawableDates({from: accounts[0]});
      preCalculatedWithdrawDates = preCalculatedWithdrawDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedWithdrawDates, [TWO_DAYS_AGO]);

      await habits.withdraw([TWO_DAYS_AGO], {from: accounts[0]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), ENTRY_FEE_WEI
        );
      });

      var status = await habits.getEntryStatus(accounts[0], TWO_DAYS_AGO, {from: accounts[0]});
      assert.equal(status, EntryStatus.WITHDRAWN);

      // can"t withdraw again
      await habits.withdraw([TWO_DAYS_AGO], {from: accounts[0]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), 0
        );
      });
      preCalculatedWithdrawAmount = await habits.calculateWithdrawableAmount({from: accounts[0]});
      assert.equal(preCalculatedWithdrawAmount, 0);
      preCalculatedWithdrawDates = await habits.getWithdrawableDates({from: accounts[0]});
      preCalculatedWithdrawDates = preCalculatedWithdrawDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedWithdrawDates, []);
    });

    it("should be able to withdraw deposit for multiple days", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], THREE_DAYS_AGO, EntryStatus.COMPLETED, {value: ENTRY_FEE_WEI}
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TWO_DAYS_AGO, EntryStatus.COMPLETED, {value: ENTRY_FEE_WEI}
      );

      // pre calculate withdraw amount and dates
      let preCalculatedWithdrawAmount = await habits.calculateWithdrawableAmount({from: accounts[0]});
      assert.equal(preCalculatedWithdrawAmount, ENTRY_FEE_WEI * 2);
      let preCalculatedWithdrawDates = await habits.getWithdrawableDates({from: accounts[0]});
      preCalculatedWithdrawDates = preCalculatedWithdrawDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedWithdrawDates, [THREE_DAYS_AGO, TWO_DAYS_AGO]);

      await habits.withdraw([THREE_DAYS_AGO, TWO_DAYS_AGO], {from: accounts[0]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), ENTRY_FEE_WEI * 2
        );
      });

      var status = await habits.getEntryStatus(accounts[0], THREE_DAYS_AGO, {from: accounts[0]});
      assert.equal(status, EntryStatus.WITHDRAWN);
      status = await habits.getEntryStatus(accounts[0], TWO_DAYS_AGO, {from: accounts[0]});
      assert.equal(status, EntryStatus.WITHDRAWN);

      // can"t withdraw again
      await habits.withdraw([THREE_DAYS_AGO, TWO_DAYS_AGO], {from: accounts[0]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), 0
        );
      });
      preCalculatedWithdrawAmount = await habits.calculateWithdrawableAmount({from: accounts[0]});
      assert.equal(preCalculatedWithdrawAmount, 0);
      preCalculatedWithdrawDates = await habits.getWithdrawableDates({from: accounts[0]});
      preCalculatedWithdrawDates = preCalculatedWithdrawDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedWithdrawDates, []);
    });

    it("should not be able to withdraw if 1.5 days has not passed", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TODAY, EntryStatus.COMPLETED, {value: ENTRY_FEE_WEI}
      );

      // pre calculate withdraw amount and dates
      let preCalculatedWithdrawAmount = await habits.calculateWithdrawableAmount({from: accounts[0]});
      assert.equal(preCalculatedWithdrawAmount, 0);
      let preCalculatedWithdrawDates = await habits.getWithdrawableDates({from: accounts[0]});
      preCalculatedWithdrawDates = preCalculatedWithdrawDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedWithdrawDates, []);

      await habits.withdraw([TODAY], {from: accounts[0]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), 0
        );
      });

      var status = await habits.getEntryStatus(accounts[0], TODAY, {from: accounts[0]});
      assert.equal(status, EntryStatus.COMPLETED);
    });

    it("should not be able to withdraw if not completed, only registered", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TWO_DAYS_AGO, EntryStatus.REGISTERED, {value: ENTRY_FEE_WEI}
      );

      // pre calculate withdraw amount and dates
      let preCalculatedWithdrawAmount = await habits.calculateWithdrawableAmount({from: accounts[0]});
      assert.equal(preCalculatedWithdrawAmount, 0);
      let preCalculatedWithdrawDates = await habits.getWithdrawableDates({from: accounts[0]});
      preCalculatedWithdrawDates = preCalculatedWithdrawDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedWithdrawDates, []);

      await habits.withdraw([TWO_DAYS_AGO], {from: accounts[0]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), 0
        );
      });

      var status = await habits.getEntryStatus(accounts[0], TWO_DAYS_AGO, {from: accounts[0]});
      assert.equal(status, EntryStatus.REGISTERED);
    });

    it("should not be able to withdraw if already withdrawn", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TWO_DAYS_AGO, EntryStatus.WITHDRAWN, {value: ENTRY_FEE_WEI}
      );

      // pre calculate withdraw amount and dates
      let preCalculatedWithdrawAmount = await habits.calculateWithdrawableAmount({from: accounts[0]});
      assert.equal(preCalculatedWithdrawAmount, 0);
      let preCalculatedWithdrawDates = await habits.getWithdrawableDates({from: accounts[0]});
      preCalculatedWithdrawDates = preCalculatedWithdrawDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedWithdrawDates, []);

      await habits.withdraw([TWO_DAYS_AGO], {from: accounts[0]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), 0
        );
      });

      var status = await habits.getEntryStatus(accounts[0], TWO_DAYS_AGO, {from: accounts[0]});
      assert.equal(status, EntryStatus.WITHDRAWN);
    });

    it("should not be able to withdraw if not even registered", async () => {
      // pre calculate withdraw amount and dates
      let preCalculatedWithdrawAmount = await habits.calculateWithdrawableAmount({from: accounts[0]});
      assert.equal(preCalculatedWithdrawAmount, 0);
      let preCalculatedWithdrawDates = await habits.getWithdrawableDates({from: accounts[0]});
      preCalculatedWithdrawDates = preCalculatedWithdrawDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedWithdrawDates, []);

      await habits.withdraw([TWO_DAYS_AGO], {from: accounts[0]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), 0
        );
      });

      var status = await habits.getEntryStatus(accounts[0], TWO_DAYS_AGO, {from: accounts[0]});
      assert.equal(status, EntryStatus.NULL);
    });

    it("should be able to withdraw and get extra bonus", async () => {
      // set up, account 0 and 1 complete, 2 forfeited, bonus is 0.5 * ENTRY_FEE * 0.9
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TWO_DAYS_AGO, EntryStatus.COMPLETED, {value: ENTRY_FEE_WEI}
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], TWO_DAYS_AGO, EntryStatus.COMPLETED, {value: ENTRY_FEE_WEI}
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[2], TWO_DAYS_AGO, EntryStatus.REGISTERED, {value: ENTRY_FEE_WEI}
      );

      // pre calculate withdraw amount and dates
      // acount 0
      let preCalculatedWithdrawAmount = await habits.calculateWithdrawableAmount({from: accounts[0]});
      assert.equal(preCalculatedWithdrawAmount, web3.toWei(ENTRY_FEE + ENTRY_FEE * 0.5 * 0.9));
      let preCalculatedWithdrawDates = await habits.getWithdrawableDates({from: accounts[0]});
      preCalculatedWithdrawDates = preCalculatedWithdrawDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedWithdrawDates, [TWO_DAYS_AGO]);

      // acount 1
      preCalculatedWithdrawAmount = await habits.calculateWithdrawableAmount({from: accounts[1]});
      assert.equal(preCalculatedWithdrawAmount, web3.toWei(ENTRY_FEE + ENTRY_FEE * 0.5 * 0.9));
      preCalculatedWithdrawDates = await habits.getWithdrawableDates({from: accounts[1]});
      preCalculatedWithdrawDates = preCalculatedWithdrawDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedWithdrawDates, [TWO_DAYS_AGO]);

      // acount 2
      preCalculatedWithdrawAmount = await habits.calculateWithdrawableAmount({from: accounts[2]});
      assert.equal(preCalculatedWithdrawAmount, 0);
      preCalculatedWithdrawDates = await habits.getWithdrawableDates({from: accounts[2]});
      preCalculatedWithdrawDates = preCalculatedWithdrawDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedWithdrawDates, []);


      // withdraw
      await habits.withdraw([TWO_DAYS_AGO], {from: accounts[0]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), web3.toWei(ENTRY_FEE + ENTRY_FEE * 0.5 * 0.9, "ether")
        );
      });
      await habits.withdraw([TWO_DAYS_AGO], {from: accounts[1]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), web3.toWei(ENTRY_FEE + ENTRY_FEE * 0.5 * 0.9, "ether")
        );
      });
      await habits.withdraw([TWO_DAYS_AGO], {from: accounts[2]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), 0
        );
      });

      var status = await habits.getEntryStatus(accounts[0], TWO_DAYS_AGO, {from: accounts[0]});
      assert.equal(status, EntryStatus.WITHDRAWN);
      status = await habits.getEntryStatus(accounts[1], TWO_DAYS_AGO, {from: accounts[0]});
      assert.equal(status, EntryStatus.WITHDRAWN);
      status = await habits.getEntryStatus(accounts[2], TWO_DAYS_AGO, {from: accounts[0]});
      assert.equal(status, EntryStatus.REGISTERED);

      // can"t withdraw again
      await habits.withdraw([TWO_DAYS_AGO], {from: accounts[0]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), 0
        );
      });
      await habits.withdraw([TWO_DAYS_AGO], {from: accounts[1]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), 0
        );
      });
    });

    it("should pass complex case", async () => {
      /*
       * Set up
       */
      for (var i = 0; i < 9; i++) {
        // four days ago, only 5 people registered, 3 completed
        if (i <= 4) {
          var fourDaysAgoStatus = EntryStatus.REGISTERED;
          if (i < 3) {
            fourDaysAgoStatus = EntryStatus.COMPLETED;
          }
          await habits.setEntryStatusForUserDateTestUtil(
            accounts[i], FOUR_DAYS_AGO, fourDaysAgoStatus,
            {value: ENTRY_FEE_WEI}
          );
        }

        // three days ago, 7 people completed
        var threeDaysAgoStatus = EntryStatus.REGISTERED;
        if (i < 7) {
          threeDaysAgoStatus = EntryStatus.COMPLETED;
        }
        await habits.setEntryStatusForUserDateTestUtil(
          accounts[i], THREE_DAYS_AGO, threeDaysAgoStatus,
          {value: ENTRY_FEE_WEI}
        );

        // two days ago, 4 people completed
        var twoDaysAgoStatus = EntryStatus.REGISTERED;
        if (i < 4) {
          twoDaysAgoStatus = EntryStatus.COMPLETED;
        }
        await habits.setEntryStatusForUserDateTestUtil(
          accounts[i], TWO_DAYS_AGO, twoDaysAgoStatus,
          {value: ENTRY_FEE_WEI}
        );

        // everyone registered and completed for today
        await habits.setEntryStatusForUserDateTestUtil(
          accounts[i], TODAY, EntryStatus.COMPLETED,
          {value: ENTRY_FEE_WEI}
        );
      }

      let fourDaysAgoBonus = await habits.getContestStatusForDateAdmin(FOUR_DAYS_AGO);
      assert.equal(fourDaysAgoBonus[0].toNumber(), 5);
      assert.equal(fourDaysAgoBonus[1].toNumber(), 3);
      assert.isNotOk(fourDaysAgoBonus[2]);

      let threeDaysAgoBonus = await habits.getContestStatusForDateAdmin(THREE_DAYS_AGO);
      assert.equal(threeDaysAgoBonus[0].toNumber(), 9);
      assert.equal(threeDaysAgoBonus[1].toNumber(), 7);
      assert.isNotOk(threeDaysAgoBonus[2]);

      let twoDaysAgoBonus = await habits.getContestStatusForDateAdmin(TWO_DAYS_AGO);
      assert.equal(twoDaysAgoBonus[0].toNumber(), 9);
      assert.equal(twoDaysAgoBonus[1].toNumber(), 4);
      assert.isNotOk(twoDaysAgoBonus[2]);

      /*
       * Account 0
       */
      var expectedWithdrawAmount = (
        5000000000000000 * 3 +
        parseInt(5000000000000000 * 2 * 0.9 / 3) +  // 4 days ago
        parseInt(5000000000000000 * 2 * 0.9 / 7) +  // 3 days ago
        parseInt(5000000000000000 * 5 * 0.9 / 4)    // 2 days ago
      );
      let withdrawableAmount = await habits.calculateWithdrawableAmount({from: accounts[0]});

      assert.equal(withdrawableAmount.toNumber(), expectedWithdrawAmount);

      let withdrawableDates = await habits.getWithdrawableDates({from: accounts[0]});
      withdrawableDates = withdrawableDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(withdrawableDates, [FOUR_DAYS_AGO, THREE_DAYS_AGO, TWO_DAYS_AGO]);

      var beforeBalance = web3.eth.getBalance(accounts[0]).toNumber();
      await habits.withdraw(withdrawableDates, {from: accounts[0]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), expectedWithdrawAmount
        );
      });
      var afterBalance = web3.eth.getBalance(accounts[0]).toNumber();

      assert.isOk(
        afterBalance - beforeBalance > 0 &&
        expectedWithdrawAmount - (afterBalance - beforeBalance) < GAS_BUFFER
      );

      /*
       * Account 1
       * NOTE: set three days ago as already WITHDRAWN
       */
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], THREE_DAYS_AGO, EntryStatus.WITHDRAWN
      );

      var expectedWithdrawAmount = (
        5000000000000000 * 2 +
        parseInt(5000000000000000 * 2 * 0.9 / 3) +  // 4 days ago
        0 +                                         // 3 days ago
        parseInt(5000000000000000 * 5 * 0.9 / 4)    // 2 days ago
      );
      withdrawableAmount = await habits.calculateWithdrawableAmount({from: accounts[1]});
      assert.equal(withdrawableAmount, expectedWithdrawAmount);

      withdrawableDates = await habits.getWithdrawableDates({from: accounts[1]});
      withdrawableDates = withdrawableDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(withdrawableDates, [FOUR_DAYS_AGO, TWO_DAYS_AGO]);

       beforeBalance = web3.eth.getBalance(accounts[1]).toNumber();
      await habits.withdraw(withdrawableDates, {from: accounts[1]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), expectedWithdrawAmount
        );
      });
      afterBalance = web3.eth.getBalance(accounts[1]).toNumber();
      assert.isOk(
        afterBalance - beforeBalance > 0 &&
        expectedWithdrawAmount - (afterBalance - beforeBalance) < GAS_BUFFER
      );

      /*
       * Account 3
       */
      expectedWithdrawAmount = (
        5000000000000000 * 2 +
        0 +                                         // 4 days ago
        parseInt(5000000000000000 * 2 * 0.9 / 7) +  // 3 days ago
        parseInt(5000000000000000 * 5 * 0.9 / 4)    // 2 days ago
      );
      withdrawableAmount = await habits.calculateWithdrawableAmount({from: accounts[3]});
      assert.equal(withdrawableAmount.toNumber(), expectedWithdrawAmount);

      withdrawableDates = await habits.getWithdrawableDates({from: accounts[3]});
      withdrawableDates = withdrawableDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(withdrawableDates, [THREE_DAYS_AGO, TWO_DAYS_AGO]);

      beforeBalance = web3.eth.getBalance(accounts[3]).toNumber();
      await habits.withdraw(withdrawableDates, {from: accounts[3]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), expectedWithdrawAmount
        );
      });
      afterBalance = web3.eth.getBalance(accounts[3]).toNumber();
      assert.isOk(
        afterBalance - beforeBalance > 0 &&
        expectedWithdrawAmount - (afterBalance - beforeBalance) < GAS_BUFFER
      );

      /*
       * Account 4
       */
      expectedWithdrawAmount = (
        5000000000000000 * 1 +
        0 +                                         // 4 days ago
        parseInt(5000000000000000 * 2 * 0.9 / 7) +  // 3 days ago
        0                                           // 2 days ago
      );
      withdrawableAmount = await habits.calculateWithdrawableAmount({from: accounts[4]});
      assert.equal(withdrawableAmount, expectedWithdrawAmount);

      withdrawableDates = await habits.getWithdrawableDates({from: accounts[4]});
      withdrawableDates = withdrawableDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(withdrawableDates, [THREE_DAYS_AGO]);

      beforeBalance = web3.eth.getBalance(accounts[4]).toNumber();
      await habits.withdraw(withdrawableDates, {from: accounts[4]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), expectedWithdrawAmount
        );
      });
      afterBalance = web3.eth.getBalance(accounts[4]).toNumber();

      assert.isOk(
        afterBalance - beforeBalance > 0 &&
        expectedWithdrawAmount - (afterBalance - beforeBalance) < GAS_BUFFER
      );

      /*
       * Account 7
       */
      expectedWithdrawAmount = 0
      withdrawableAmount = await habits.calculateWithdrawableAmount({from: accounts[7]});
      assert.equal(withdrawableAmount, expectedWithdrawAmount);

      withdrawableDates = await habits.getWithdrawableDates({from: accounts[7]});
      withdrawableDates = withdrawableDates.map(x => x.toNumber()).filter(x => x > 0);
      compareArray(withdrawableDates, []);

      // should still be zero even when invalid dates are passed in
      await habits.withdraw(
        [TODAY, TWO_DAYS_AGO, THREE_DAYS_AGO, FOUR_DAYS_AGO, FIVE_DAYS_AGO],
        {from: accounts[7]}
      ).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), 0
        );
      });

      /*
       * Withdrawing Operation Fee
       */
      // can"t withdraw from non-owner account
      assertRevert(habits.withdrawOperationFees([TODAY], {from: accounts[1]}));

      var expectedOperationWithdrawAmount = (
        parseInt(5000000000000000 * 2 * 0.1) +  // 4 days ago
        parseInt(5000000000000000 * 2 * 0.1) +  // 3 days ago
        parseInt(5000000000000000 * 5 * 0.1)    // 2 days ago
      );
      var dates = [TODAY, TWO_DAYS_AGO, THREE_DAYS_AGO, FOUR_DAYS_AGO, FIVE_DAYS_AGO];

      // no owner account returns blank
      let preCalculatedOperationFeeDatesAndAmount = (
        await habits.getWithdrawableOperationFeeDatesAndAmount({from: accounts[1]})
      );
      compareArray(preCalculatedOperationFeeDatesAndAmount[0], []);
      assert.equal(preCalculatedOperationFeeDatesAndAmount[1], 0);
      let contestStatus = await habits.getContestStatusForDateAdmin(FIVE_DAYS_AGO);
      assert.isNotOk(contestStatus[2]);
      contestStatus = await habits.getContestStatusForDateAdmin(FOUR_DAYS_AGO);
      assert.isNotOk(contestStatus[2]);
      contestStatus = await habits.getContestStatusForDateAdmin(THREE_DAYS_AGO);
      assert.isNotOk(contestStatus[2]);
      contestStatus = await habits.getContestStatusForDateAdmin(TWO_DAYS_AGO);
      assert.isNotOk(contestStatus[2]);
      contestStatus = await habits.getContestStatusForDateAdmin(TODAY);
      assert.isNotOk(contestStatus[2]);

      // should work with owner account
      preCalculatedOperationFeeDatesAndAmount = (
        await habits.getWithdrawableOperationFeeDatesAndAmount({from: accounts[0]})
      );
      let preCalculatedDates = preCalculatedOperationFeeDatesAndAmount[0].map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedDates, [FOUR_DAYS_AGO, THREE_DAYS_AGO, TWO_DAYS_AGO]);
      assert.equal(preCalculatedOperationFeeDatesAndAmount[1], expectedOperationWithdrawAmount);

      await habits.withdrawOperationFees(dates, {from: accounts[0]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), expectedOperationWithdrawAmount
        );
      });

      // shouldn"t be able to withdraw multiple times
      await habits.withdrawOperationFees(dates, {from: accounts[0]}).then((result) => {
        assert.equal(
          result.logs[0].args.amount.toNumber(), 0
        );
      });

      // pre calculations should also return empty now
      preCalculatedOperationFeeDatesAndAmount = (
        await habits.getWithdrawableOperationFeeDatesAndAmount({from: accounts[0]})
      );
      preCalculatedDates = preCalculatedOperationFeeDatesAndAmount[0].map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedDates, []);
      assert.equal(preCalculatedOperationFeeDatesAndAmount[1], 0);

      contestStatus = await habits.getContestStatusForDateAdmin(FIVE_DAYS_AGO);
      assert.isOk(contestStatus[2]);
      contestStatus = await habits.getContestStatusForDateAdmin(FOUR_DAYS_AGO);
      assert.isOk(contestStatus[2]);
      contestStatus = await habits.getContestStatusForDateAdmin(THREE_DAYS_AGO);
      assert.isOk(contestStatus[2]);
      contestStatus = await habits.getContestStatusForDateAdmin(TWO_DAYS_AGO);
      assert.isOk(contestStatus[2]);
      contestStatus = await habits.getContestStatusForDateAdmin(TODAY);
      assert.isNotOk(contestStatus[2]);
    });
  });

  describe("getUserEntryStatuses", () => {
    it("should get multiple days worth of entry statuses", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], FIVE_DAYS_AGO, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], FOUR_DAYS_AGO, EntryStatus.WITHDRAWN
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], THREE_DAYS_AGO, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], TWO_DAYS_AGO, EntryStatus.COMPLETED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], YESTERDAY, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], TODAY, EntryStatus.COMPLETED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], TOMORROW, EntryStatus.REGISTERED
      );

      let entryStatuses = await habits.getUserEntryStatuses({from: accounts[1]});

      let days = entryStatuses[0].map(x => x.toNumber());
      assert.deepEqual(
        days,
        [FIVE_DAYS_AGO, FOUR_DAYS_AGO, THREE_DAYS_AGO, TWO_DAYS_AGO, YESTERDAY, TODAY, TOMORROW]
      );

      let statuses = entryStatuses[1].map(x => x.toNumber());
      assert.deepEqual(
        statuses,
        [
          EntryStatus.REGISTERED,
          EntryStatus.WITHDRAWN,
          EntryStatus.REGISTERED,
          EntryStatus.COMPLETED,
          EntryStatus.REGISTERED,
          EntryStatus.COMPLETED,
          EntryStatus.REGISTERED
        ]
      );
    });
  });

  describe("withdrawOperationFees", () => {
    it("shoud withdraw entire deposit if there are no completes", async() => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TWO_DAYS_AGO, EntryStatus.REGISTERED,
        {value: ENTRY_FEE_WEI}
      );

      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], TWO_DAYS_AGO, EntryStatus.REGISTERED,
        {value: ENTRY_FEE_WEI}
      );

      let preCalculatedOperationFeeDatesAndAmount = (
        await habits.getWithdrawableOperationFeeDatesAndAmount({from: accounts[0]})
      );
      let preCalculatedDates = preCalculatedOperationFeeDatesAndAmount[0].map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedDates, [TWO_DAYS_AGO]);
      assert.equal(preCalculatedOperationFeeDatesAndAmount[1].toNumber(),  ENTRY_FEE_WEI * 2);
      let contestStatus = await habits.getContestStatusForDateAdmin(TWO_DAYS_AGO);
      assert.isNotOk(contestStatus[2]);

      await habits.withdrawOperationFees(
        [TWO_DAYS_AGO], {from: accounts[0]}
      ).then((result) => {
        assert.equal(
          result.logs[0].args.amount,
          ENTRY_FEE_WEI * 2
        );
      });

      // shouldn"t be able to withdraw multiple times
      await habits.withdrawOperationFees(
        [TWO_DAYS_AGO], {from: accounts[0]}
      ).then((result) => {
        assert.equal(result.logs[0].args.amount, 0);
      });

      // pre calculations should also return empty now
      preCalculatedOperationFeeDatesAndAmount = (
        await habits.getWithdrawableOperationFeeDatesAndAmount({from: accounts[0]})
      );
      preCalculatedDates = preCalculatedOperationFeeDatesAndAmount[0].map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedDates, []);
      assert.equal(preCalculatedOperationFeeDatesAndAmount[1], 0);
      contestStatus = await habits.getContestStatusForDateAdmin(TWO_DAYS_AGO);
      assert.isOk(contestStatus[2]);
    });

    it("should not be able to withdraw if date is bogus", async() => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TWO_DAYS_AGO, EntryStatus.REGISTERED,
        {value: ENTRY_FEE_WEI}
      );

      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], TWO_DAYS_AGO, EntryStatus.REGISTERED,
        {value: ENTRY_FEE_WEI}
      );

      await habits.withdrawOperationFees(
        [TWO_DAYS_AGO - 1], {from: accounts[0]}
      ).then((result) => {
        assert.equal(result.logs[0].args.amount, 0);
      });
    });

    it("shoud be able to handle multiple days", async() => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], THREE_DAYS_AGO, EntryStatus.REGISTERED,
        {value: ENTRY_FEE_WEI}
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], THREE_DAYS_AGO, EntryStatus.COMPLETED,
        {value: ENTRY_FEE_WEI}
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TWO_DAYS_AGO, EntryStatus.REGISTERED,
        {value: ENTRY_FEE_WEI}
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], TWO_DAYS_AGO, EntryStatus.REGISTERED,
        {value: ENTRY_FEE_WEI}
      );

      let preCalculatedOperationFeeDatesAndAmount = (
        await habits.getWithdrawableOperationFeeDatesAndAmount({from: accounts[0]})
      );
      let preCalculatedDates = preCalculatedOperationFeeDatesAndAmount[0].map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedDates, [THREE_DAYS_AGO, TWO_DAYS_AGO]);
      assert.equal(
        preCalculatedOperationFeeDatesAndAmount[1].toNumber(),
        web3.toWei(2 * ENTRY_FEE + 0.1 * ENTRY_FEE, "ether")
      )
      let contestStatus = await habits.getContestStatusForDateAdmin(THREE_DAYS_AGO);
      assert.isNotOk(contestStatus[2]);
      contestStatus = await habits.getContestStatusForDateAdmin(TWO_DAYS_AGO);
      assert.isNotOk(contestStatus[2]);

      await habits.withdrawOperationFees(
        [THREE_DAYS_AGO, TWO_DAYS_AGO], {from: accounts[0]}
      ).then((result) => {
        assert.equal(
          result.logs[0].args.amount,
          web3.toWei(2 * ENTRY_FEE + 0.1 * ENTRY_FEE, "ether")
        );
      });

      // shouldn"t be able to withdraw multiple times
      await habits.withdrawOperationFees(
        [THREE_DAYS_AGO, TWO_DAYS_AGO], {from: accounts[0]}
      ).then((result) => {
        assert.equal(result.logs[0].args.amount, 0);
      });

      // pre calculations should also return empty now
      preCalculatedOperationFeeDatesAndAmount = (
        await habits.getWithdrawableOperationFeeDatesAndAmount({from: accounts[0]})
      );
      preCalculatedDates = preCalculatedOperationFeeDatesAndAmount[0].map(x => x.toNumber()).filter(x => x > 0);
      compareArray(preCalculatedDates, []);
      assert.equal(preCalculatedOperationFeeDatesAndAmount[1], 0);
      contestStatus = await habits.getContestStatusForDateAdmin(THREE_DAYS_AGO);
      assert.isOk(contestStatus[2]);
      contestStatus = await habits.getContestStatusForDateAdmin(TWO_DAYS_AGO);
      assert.isOk(contestStatus[2]);
    });
  });

  describe("getContestStatusForDate", () => {
    it("should return 0s for bogus date", async() => {
      let status = await habits.getContestStatusForDate(TWO_DAYS_AGO - 1);
      assert.equal(status[0], 0);
      assert.equal(status[1], 0);
      assert.equal(status[2], 0);
    });

    it("should only returned number of regsitered users", async() => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TODAY, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], TODAY, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[2], TODAY, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[3], TODAY, EntryStatus.COMPLETED
      );
      let status = await habits.getContestStatusForDate(TODAY);
      assert.equal(status[0], 4);
      assert.equal(status[1], -1);
      assert.equal(status[2], -1);
    });

    it("should return entire status for two days ago", async() => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TWO_DAYS_AGO, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], TWO_DAYS_AGO, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[2], TWO_DAYS_AGO, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[3], TWO_DAYS_AGO, EntryStatus.COMPLETED
      );
      let status = await habits.getContestStatusForDate(TWO_DAYS_AGO);
      assert.equal(status[0], 4);
      assert.equal(status[1], 1);
      assert.equal(status[2], web3.toWei(ENTRY_FEE * 3 * 0.9, "ether"));
    });
  });

  describe("getStartDate and getLastRegisterDate", () => {
    it("should return tomorrow as start date for new users", async() => {
      let lastDate = await habits.getLastRegisterDateTestUtil();
      assert.equal(lastDate, 0);

      let startDate = await habits.getStartDate({from: accounts[0]});
      assert.equal(startDate, TOMORROW);
    });

    it("should return next start day as 11 days from now", async() => {
      await habits.register(TOMORROW, {from: accounts[0], value: DEFAULT_ENTRY_FEE_WEI});
      let lastDate = await habits.getLastRegisterDateTestUtil();
      assert.equal(lastDate, TODAY + 10 * DAY);

      let startDate = await habits.getStartDate({ from: accounts[0]});
      assert.equal(startDate, lastDate.toNumber() + DAY);
    });

    it("should return next start day as 21 days from now", async() => {
      await habits.register(TOMORROW, { from: accounts[0], value: DEFAULT_ENTRY_FEE_WEI });
      await habits.register(TOMORROW + 10 * DAY, { from: accounts[0], value: DEFAULT_ENTRY_FEE_WEI });
      let lastDate = await habits.getLastRegisterDateTestUtil();
      assert.equal(lastDate, TODAY + 20 * DAY);

      let startDate = await habits.getStartDate({ from: accounts[0]});
      assert.equal(startDate, lastDate.toNumber() + DAY);
    });

    it("should return next start day as 4 days from now", async() => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TODAY, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TOMORROW, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TODAY + 2 * DAY, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TODAY + 3 * DAY, EntryStatus.REGISTERED
      );
      let lastDate = await habits.getLastRegisterDateTestUtil();
      assert.equal(lastDate, TODAY + 3 * DAY);

      let startDate = await habits.getStartDate({ from: accounts[0]});
      assert.equal(startDate, lastDate.toNumber() + DAY);
    });
  });

  describe("getNextDate, getDate", () => {
    it("should calculate the date floor correctly", async () => {
      let date1 = await habits.getDateTestUtil(1524330577);
      assert.equal(date1, 1524268800);

      let date2 = await habits.getDateTestUtil(1524936323);
      assert.equal(date2, 1524873600);
    });

    it("should calculate tomorrow correctly", async () => {
      let date1 = await habits.getNextDateTestUtil(1524330577);
      assert.equal(date1, 1524268800 + DAY);

      let date2 = await habits.getNextDateTestUtil(1524936323);
      assert.equal(date2, 1524873600 + DAY);
    });
  });

  describe("calculateBonus, calculateOperationFee", () => {
    it("should be zero for dates no one registered", async () => {
      let bonus = await habits.calculateBonusTestUtil(TWO_DAYS_AGO);
      assert.equal(bonus, 0);

      let operationFee = await habits.calculateOperationFeeTestUtil(TWO_DAYS_AGO);
      assert.equal(operationFee, 0);
    });

    it("should be 100% operation fee if zero completes", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TWO_DAYS_AGO, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], TWO_DAYS_AGO, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[2], TWO_DAYS_AGO, EntryStatus.REGISTERED
      );

      let bonus = await habits.calculateBonusTestUtil(TWO_DAYS_AGO);
      assert.equal(bonus, 0);

      let operationFee = await habits.calculateOperationFeeTestUtil(TWO_DAYS_AGO);
      assert.equal(operationFee, web3.toWei(ENTRY_FEE * 3, "ether"));
    });

    it("should calculate bonus and operation fee correctly", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TWO_DAYS_AGO, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], TWO_DAYS_AGO, EntryStatus.REGISTERED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[2], TWO_DAYS_AGO, EntryStatus.COMPLETED
      );

      let bonus = await habits.calculateBonusTestUtil(TWO_DAYS_AGO);
      assert.equal(bonus, web3.toWei(0.009, "ether"));

      let operationFee = await habits.calculateOperationFeeTestUtil(TWO_DAYS_AGO);
      assert.equal(operationFee, web3.toWei(0.001, "ether"));
    });

    it("should be zero bonus and operation fee if everyone completes", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[0], TWO_DAYS_AGO, EntryStatus.COMPLETED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[1], TWO_DAYS_AGO, EntryStatus.COMPLETED
      );
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[2], TWO_DAYS_AGO, EntryStatus.COMPLETED
      );

      let bonus = await habits.calculateBonusTestUtil(TWO_DAYS_AGO);
      assert.equal(bonus, 0);

      let operationFee = await habits.calculateOperationFeeTestUtil(TWO_DAYS_AGO);
      assert.equal(operationFee, 0);
    });
  });

  describe("Admin", () => {
    it("should only return values if admin", async () => {
      await habits.setEntryStatusForUserDateTestUtil(
        accounts[2], TWO_DAYS_AGO, EntryStatus.COMPLETED
      );
      let dates = await habits.getDatesForUser(accounts[2], {from: accounts[1]});
      compareArray(dates, []);
      let users = await habits.getUsersForDate(TWO_DAYS_AGO, {from: accounts[1]});
      compareArray(users, []);
      let entryStatus = await habits.getEntryStatus(accounts[2], TWO_DAYS_AGO, {from: accounts[1]});
      assert.equal(entryStatus, EntryStatus.NULL);
      let contestStatus = await habits.getContestStatusForDateAdmin(TWO_DAYS_AGO, {from: accounts[1]});
      assert.equal(contestStatus[0], 0);
      assert.equal(contestStatus[1], 0);
      assert.isNotOk(contestStatus[2]);

      // only owner can add admin
      assertRevert(habits.addAdmin(accounts[1], {from: accounts[1]}));
      await habits.addAdmin(accounts[1], {from: accounts[0]});

      dates = await habits.getDatesForUser(accounts[2], {from: accounts[1]});
      compareArray(dates, [TWO_DAYS_AGO]);
      users = await habits.getUsersForDate(TWO_DAYS_AGO, {from: accounts[1]});
      compareArray(users, [accounts[2]]);
      entryStatus = await habits.getEntryStatus(accounts[2], TWO_DAYS_AGO, {from: accounts[1]});
      assert.equal(entryStatus, EntryStatus.COMPLETED);
      contestStatus = await habits.getContestStatusForDateAdmin(TWO_DAYS_AGO, {from: accounts[1]});
      assert.equal(contestStatus[0], 1);
      assert.equal(contestStatus[1], 1);
      assert.isNotOk(contestStatus[2]);
    });
  });

  // describe("Stress Test", () => {
  //   it("should be able to return five years worth of status", async() => {
  //     let numberOfDays = 1500;
  //     let expectedStatusArray = [];
  //     let expectedWithdrawableDates = [];
  //     for (var i = numberOfDays; i > 0; i--) {
  //       let status = i % 2 === 0 ? EntryStatus.REGISTERED: EntryStatus.COMPLETED;
  //       let date = YESTERDAY - i * DAY;
  //       await habits.setEntryStatusForUserDateTestUtil(
  //         accounts[6], date, status, {value: ENTRY_FEE_WEI, from: accounts[6]}
  //       );
  //       expectedStatusArray.push(status);
  //       if (i % 2 !== 0) {
  //         expectedWithdrawableDates.push(date);
  //       }
  //     }
  //     let statuses = await habits.getUserEntryStatuses({from: accounts[6], gas: WEB3_GAS_MAX});
  //     assert.equal(statuses[0][0], YESTERDAY - numberOfDays * DAY);
  //     assert.equal(statuses[0][numberOfDays - 1], TWO_DAYS_AGO);
  //     assert.equal(statuses[0].length, numberOfDays);
  //     compareArray(statuses[1], expectedStatusArray)
  //     let withdrawableDates = await habits.getWithdrawableDates({from: accounts[6], gas: WEB3_GAS_MAX});
  //     withdrawableDates = withdrawableDates.map(x => x.toNumber()).filter(x => x > 0);
  //     let withdrawbleAmount = await habits.calculateWithdrawableAmount({from: accounts[6], gas: WEB3_GAS_MAX});
  //     let expectedWithdrawAmount = web3.toWei(expectedWithdrawableDates.length * ENTRY_FEE, 'ether');
  //     compareArray(withdrawableDates, expectedWithdrawableDates);
  //     assert.equal(withdrawbleAmount, expectedWithdrawAmount);
  //     await habits.withdraw(
  //       expectedWithdrawableDates,
  //       {from: accounts[6]}
  //     ).then((result) => {
  //       assert.equal( result.logs[0].args.amount, expectedWithdrawAmount);
  //     });
  //   })
  // });
});
