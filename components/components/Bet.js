import React from 'react';
import { StyleSheet, View, Platform, TouchableHighlight } from 'react-native';
import { Text, Button, Icon, Card } from 'react-native-elements';
import UserList from './UserList';
import * as firebase from 'firebase';
import * as Haptics from 'expo-haptics';
import ThemeColors from '../assets/ThemeColors';

export default class Bet extends React.Component {
  constructor(props) {
    super(props);

    this.timer = 0;
    this.syncTimer = 0;

    this.state = {
      timeLeft: '',
    };
  }

  componentDidMount() {
    if (this.props.bet.lockDate && this.props.bet.status === 'open') {
      let timeLeft = this.calculateTimeLeft();

      if (timeLeft === 0) {
        this.lockBet();
      }

      this.setState({ timeLeft });

      if (this.timer === 0 && timeLeft.day === 0 && timeLeft.hour === 0 && timeLeft.minute <= 5) {
        this.startTimer();
      } else if (this.timer === 0 && timeLeft.day === 0 && timeLeft.hour === 0) {
        this.syncTimer = setTimeout(() => {
          this.timer = setInterval(() => {
            let timeLeft = this.calculateTimeLeft();
            this.setState({ timeLeft: { minute: timeLeft.minute} });
  
            if (timeLeft.day === 0 && timeLeft.hour === 0 && timeLeft.minute <= 5) {
              clearInterval(this.timer);
              this.startTimer();
            }
          }, 60000);
        }, timeLeft.second*1000);
      } else {
        if (timeLeft.day > 0) {
          this.setState({ timeLeft: { day: timeLeft.day } });
        } else if (timeLeft.hour > 0) {
          this.setState({ timeLeft: { hour: timeLeft.hour } });
        } else if (timeLeft.minute > 5) {
          this.setState({ timeLeft: { minute: timeLeft.minute } });
        }
      }
    }
  }

  componentWillUnmount() {
    if (this.timer !== 0) {
      console.log('in unmount');
      console.log(this.timer);
      clearInterval(this.timer);
    }
    if (this.syncTimer !== 0) {
      console.log('in unmount sync');
      console.log(this.syncTimer);
      clearTimeout(this.syncTimer);
    }
  }

  startTimer = () => {
    this.timer = setInterval(() => {
      let timeLeft = this.calculateTimeLeft();

      this.setState({ timeLeft });

      if (timeLeft === 0) {
        clearInterval(this.timer);
        this.lockBet();
      }
    }, 1000);
  }

  calculateTimeLeft = () => {
    let difference = this.props.bet.lockDate - +new Date();
    let timeLeft = 0;

    if (difference > 0) {
      timeLeft = {
        day: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hour: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minute: Math.floor((difference / 1000 / 60) % 60),
        second: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  };

  lockBet = () => {
    const betRef = firebase.database().ref('Bet/' + this.props.bet.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if(!this.props.bet.users || this.props.bet.users?.length < 2) {
      betRef.update({ status: 'complete' });
    } else {
      betRef.update({ status: 'locked' });
    }
  }

  startVoting = () => {
    const betRef = firebase.database().ref('Bet/' + this.props.bet.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    betRef.update({ status: 'voting' });
  }

  completeBet = () => {
    const betRef = firebase.database().ref('Bet/' + this.props.bet.id);
    betRef.update({ status: 'complete' });
  }

  onPress = () => {
    const { bet, user } = this.props;

    if (bet.status === 'open' || bet.users?.find(u => u.username === user.username) && bet.users?.find(u => u.username === user.username)?.votedOption === undefined 
      || bet.status === 'complete' && bet.users?.find(u => u.username === user.username)) {
      this.props.navigation.navigate('BetOptionsScreen', { bet, user });
    }
  }

  renderTimer = () => {
    let { timeLeft } = this.state;
    let timerComponents = [];

    if (timeLeft.day > 0) {
      timeLeft = { day: timeLeft.day };
    } else if (timeLeft.hour > 0) {
      timeLeft = { hour: timeLeft.hour };
    } else if (timeLeft.minute > 4) {
      timeLeft = { minute: timeLeft.minute };
    }

    Object.keys(timeLeft).forEach((interval) => {
      if (!timeLeft[interval]) {
        return;
      }

      timerComponents.push(
        <Text key={interval}>
          {timeLeft[interval]} {interval}{timeLeft[interval] > 1 ? 's  ' : ' '}
        </Text>
      );
    });

    return timerComponents;
  }

  render() {
    const { colors, bet, user } = this.props;

    let borderColor = ThemeColors.border;
    let backgroundColor = ThemeColors.card

    if (bet.status === 'complete') {
      if (bet.users?.find(u => u.username === user.username)) {
        borderColor = bet.users.find(u => u.username === user.username).selectedOption === bet.winningOption ? '#2ac73b' : 'red';
      } else {
        borderColor = ThemeColors.text;
      }
      backgroundColor = ThemeColors.disabledCard;
    }

    const buttons = {
      open: user.username === bet.createdBy && !bet.lockDate ? (
        <View style={[styles.row, styles.betAndLockRow]}>
          <View style={styles.betButtonContainer}>
            <Button title="Vow" buttonStyle={styles.betButton} onPress={this.onPress} />
          </View>
          <View style={[styles.betButtonContainer, styles.lockButtonContainer]}>
            <Button title="Lock" buttonStyle={styles.betButton} onPress={this.lockBet} />
          </View>
        </View>
      ) : (
        <View style={styles.betButtonContainer}>
          <Button title="Vow" buttonStyle={styles.betButton} onPress={this.onPress} />
        </View>
      ),
      locked: user.username === bet.createdBy ? (
        <View style={styles.startVotingButtonContainer}>
          <Button title="Start Voting" buttonStyle={styles.betButton} onPress={this.startVoting} />
        </View>
      ) : (
        <View style={styles.betButtonContainer}>
          <Button
            icon={<Icon name="md-lock" type="ionicon" size={15} />}
            disabled
            buttonStyle={styles.betButton}
          />
        </View>
      ),
      voting: bet.users && bet.users.find(u => u.username === user.username)?.votedOption === undefined ? (
        <View style={styles.betButtonContainer}>
          <Button title="Vote" buttonStyle={styles.betButton} onPress={this.onPress} disabled={!bet.users?.find(u => u.username === user.username)} />
        </View>
      ) : <Text style={styles.waiting}>Waiting on remaining votes...</Text>,
      complete: bet.status === 'complete' && bet.users?.length >= 2 ? (
        <Text h4 style={styles.winningOption}>
          {bet.winningOption !== 'Draw' ? bet.options[bet.winningOption]?.title : 'Draw'}
        </Text>
      ) : <Text style={styles.waiting}>Not enough participants</Text>,
    };

    return (
      <TouchableHighlight style={styles.cardWrapper} onPress={this.onPress} disabled={bet.status !== 'open' && !bet.users?.find(u => u.username === user.username) || bet.status === 'voting' && bet.users?.find(u => u.username === user.username)?.votedOption !== undefined}>
        <View style={[{ borderColor, backgroundColor }, styles.card]}>
          <View style={[styles.row, styles.createdByRow]}>
            <View>
              <Icon name="md-person" type="ionicon" size={15} color={ThemeColors.text} />
            </View>
            <View style={styles.createdByContainer}>
              <Text numberOfLines={1} style={styles.createdByText}>{bet.createdBy}</Text>
            </View>
            <View style={[styles.createdByContainer, styles.wager]}>
              <Text numberOfLines={1} style={styles.createdByText}>{bet.wager || 'No wager'}</Text>
            </View>
          </View>
          <Text style={[styles.betName, {fontFamily: 'Audio-Wide'}]}>{bet.title}</Text>
          {bet.status === 'open' && bet.lockDate && (
            <View style={[styles.row, styles.timerRow, styles.countdownContainer]}>
              <View>
                <Icon name="md-time" type="ionicon" size={15} color={ThemeColors.button} />
              </View>
              <View style={styles.timerContainer}>
                <Text>{this.renderTimer()}</Text>
              </View>
            </View>
          )}
          {buttons[bet.status]}
          {bet.users?.length > 0 ? <UserList users={bet.users} bet={bet} colors={colors} onCard /> : <Text style={styles.noParticipants}>No participants</Text>}
        </View>
      </TouchableHighlight>
    );
  }
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.3,
    padding: 15,
    borderRadius: 8,
    minHeight: 155
  },
  cardWrapper: {
    marginHorizontal: 15, 
    marginTop: 15,
    borderRadius: 8,
  },
  countdownContainer: {
    alignSelf: 'center'
  },
  betButtonContainer: {
    width: '33%',
    alignSelf: 'center',
  },
  lockButtonContainer: {
    marginLeft: 10
  },
  startVotingButtonContainer: {
    width: '50%',
    alignSelf: 'center'
  },
  betButton: {
    paddingVertical: 2,
    minHeight: 31,
  },
  betAndLockRow: {
    justifyContent: 'center'
  },
  createdByRow: {
    marginBottom: 10,
    marginTop: -7,
    marginLeft: -7,
  },
  createdByContainer: {
    marginLeft: 5,
    marginTop: Platform.OS === 'ios' ? -1 : -3,
  },
  createdByText: {
    fontSize: 15,
    color: ThemeColors.text,
    maxWidth: 120
  },
  noParticipants: {
    paddingTop: 15,
    paddingBottom: 5,
  },
  timerRow: {
    marginBottom: 5,
    marginTop: 0,
  },
  timerContainer: {
    marginLeft: 5,
    marginTop: Platform.OS === 'ios' ? -1 : -2,
  },
  winningOption: {
    alignSelf: 'center',
    marginTop: -5,
    fontWeight: 'bold',
  },
  wager: {
    position: 'absolute',
    right: -7,
  },
  waiting: {
    alignSelf: 'center',
    marginTop: 10,
    minHeight: 31
  },
  row: {
    flexDirection: 'row',
  },
  betName: {
    textAlign: 'center',
    fontSize: 17,
    color: ThemeColors.textTitle,
    textShadowColor: ThemeColors.textTitle,
    textShadowRadius: 6,
    marginBottom: 10,
  }
});
