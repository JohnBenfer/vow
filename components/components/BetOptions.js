import React from 'react';
import { StyleSheet, View, SafeAreaView, FlatList, Platform, StatusBar } from 'react-native';
import { ListItem, Button, Text, Icon } from 'react-native-elements';
import LoadingSpinner from './LoadingSpinner';
import UserList from './UserList';
import * as firebase from 'firebase';
import { AddBetsToUserFile, RemoveBetsFromUserFile } from '../Util';
import * as Haptics from 'expo-haptics';
import { UserColors } from '../ColorContext';
import {useTheme} from '@react-navigation/native';
import ThemeColors from '../assets/ThemeColors';

class BetOptions extends React.Component {
  constructor(props) {
    super(props);

    const { bet, user } = props.route.params;

    this.betRef = firebase.database().ref('Bet/' + bet.id);
    this.timer = 0;
    this.state = {
      bet,
      selectedOption: bet.status !== 'voting' ? bet.users?.find(u => u.username === user.username)?.selectedOption : null,
      timeLeft: '',
      loading: false
    };
  }

  componentDidMount() {
    if (this.state.bet.lockDate && this.state.bet.status === 'open') {
      let timeLeft = this.calculateTimeLeft();
      this.setState({ timeLeft });

      if (this.timer === 0 && timeLeft.day === 0 && timeLeft.hour === 0 && timeLeft.minute <= 5) {
        this.startTimer();
      } else if (timeLeft.day === 0 && timeLeft.hour === 0) {
        this.timer = setInterval(() => {
          let timeLeft = this.calculateTimeLeft();

          this.setState({ timeLeft });

          if (timeLeft.day === 0 && timeLeft.hour === 0 && timeLeft.minute <= 5) {
            clearInterval(this.timer);
            this.startTimer();
          }
        }, 60000);
      }
    }

    
    this.betRef.on('child_changed', (data) => {
      let newBet = {};
      newBet[data.key] = data.val();
      if (data.val() === 'voting') {
        this.setState({ selectedOption: null });
      }
      this.setState({ bet: Object.assign(this.state.bet, newBet) });
    });
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    this.betRef.off();
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
    let difference = this.state.bet.lockDate - +new Date();
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
  }

  selectOption = (selectedOption) => {
    if (selectedOption === this.state.selectedOption) {
      this.setState({ selectedOption: null });
    } else {
      Platform.OS === 'ios' ? Haptics.selectionAsync() : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      this.setState({ selectedOption });
    }
  }

  renderOption = (option, index) => {
    const { bet, selectedOption } = this.state;

    return (
      <ListItem
        key={index}
        bottomDivider
        onPress={() => this.selectOption(index)}
        disabled={bet.status === 'locked' || bet.status === 'complete'}
        disabledStyle={selectedOption === index && bet.status !== 'complete' ? styles.disabledOption : null}
      >
        <Icon
          name={selectedOption === index ? "dot-circle" : "circle"}
          type="font-awesome-5"
          color={bet.status === 'locked' ? 'grey' : "#2089dc"}
          size={15}
        />
        <ListItem.Content>
          <ListItem.Title>{option.title}</ListItem.Title>
        </ListItem.Content>
        {bet.status === 'locked' && selectedOption === index ? (
          <ListItem.Chevron name="md-lock" type="ionicon" color="grey" />
        ) : null}
        {bet.status === 'complete' && 
          <View style={styles.userListOptionContainer}>
            <UserList users={bet.users.filter(user => user.selectedOption === index)} colors={this.context.userColors} onCard onOption />
          </View>
        }
      </ListItem>
    );
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

  lockBet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if(!this.state.bet.users || this.state.bet.users?.length < 2) {
      this.betRef.update({ status: 'complete' });
    } else {
      this.betRef.update({ status: 'locked' });
    }
  }

  startVoting = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.betRef.update({ status: 'voting' });
  }

  getWinningOption = (numbers) => {
    let map = new Map();
    for (let num of numbers) {
      map.set(num, (map.get(num) || 0) + 1);
    }

    let winningOption = NaN;
    let counts = Array.from(map.values());

    if (counts.length > 1 && counts.every(count => count === counts[0])) {
      winningOption = "Draw";
    } else {
      let maxCount = -1;

      for (let [num, count] of map.entries()) {
        if (count > maxCount) {
          maxCount = count;
          winningOption = num;
        }
      }
    }

    return winningOption
  }

  save = async () => {
    const { user } = this.props.route.params;

    this.setState({ loading: true });

    const betRef = firebase.database().ref('Bet/' + this.props.route.params.bet.id);
    await betRef.transaction((bet) => {
      if (bet) {
        if (bet.users && bet.users.find(u => u.username === user.username)) {
          if (this.props.route.params.bet.status === 'open') {
            if (this.state.selectedOption === null) {
              RemoveBetsFromUserFile([this.props.route.params.bet.id]);
              bet.users.splice(bet.users.findIndex(u => u.username === user.username), 1);
            } else {
              bet.users.find(u => u.username === user.username).selectedOption = this.state.selectedOption;
            }
          } else {
            bet.users.find(u => u.username === user.username).votedOption = this.state.selectedOption;

            if (bet.users.every(u => u.votedOption !== undefined)) {
              bet.winningOption = this.getWinningOption(bet.users.map(u => u.votedOption));
              bet.status = 'complete';
            }
          }
        } else {
          if (!bet.users) {
            bet.users = [];
          }
          bet.users.push({ username: user.username, selectedOption: this.state.selectedOption });
          AddBetsToUserFile([this.props.route.params.bet.id]);
        }

      }
      return bet;
    });

    this.setState({ loading: false });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    this.props.navigation.goBack();
  }

  render() {
    const { loading, bet, selectedOption } = this.state;
    const { user } = this.props.route.params;
    const userSavedOption = bet.users?.find(u => u.username === user.username)?.selectedOption;
    const disableSaveButton = bet.status === 'voting' && selectedOption === null || 
      bet.status === 'locked' || bet.status === 'complete' ||
      bet.status === 'open' && (userSavedOption === undefined && selectedOption === null || userSavedOption === selectedOption);

    const buttons = {
      open: user.username === bet.createdBy && !bet.lockDate && (
        <View style={styles.lockButtonContainer}>
          <Button title="Lock" buttonStyle={styles.lockButton} onPress={this.lockBet} />
        </View>
      ),
      locked: user.username === bet.createdBy && (
        <View style={styles.lockButtonContainer}>
          <Button title="Start Voting" buttonStyle={styles.lockButton} onPress={this.startVoting} />
        </View>
      ),
      voting: null,
      complete: null
    };

    const header = (
      <View style={[styles.container, {backgroundColor: this.props.theme.colors.background}]}>
        <View style={styles.row}>
          <View style={styles.cancelButtonContainer}>
            <Button
              onPress={() => this.props.navigation.goBack()}
              title="Cancel"
              type="clear"
              titleStyle={styles.cancelButtonTitle}
              buttonStyle={{backgroundColor: 'transparent'}}
            />
          </View>
          <View style={styles.createdByRowContainer}>
            <View style={styles.row}>
              <View>
                <Icon name="md-person" type="ionicon" size={15} color={ThemeColors.border} />
              </View>
              <View style={styles.createdByContainer}>
                <Text numberOfLines={1} style={styles.createdByText}>{bet.createdBy}</Text>
              </View>
            </View>
          </View>
          <View style={styles.saveButtonContainer}>
            <Button
              onPress={this.save}
              title="Save"
              containerStyle={styles.saveButtonBorder}
              titleStyle={styles.saveButtonTitle}
              disabled={disableSaveButton}
            />
          </View>
        </View>
        <View style={styles.userListContainer}>
          <UserList users={bet.users} bet={bet} colors={this.context.userColors} />
        </View>
        <View style={styles.title}>
          <Text style={[styles.titleText, {fontFamily: 'Audio-Wide'}]}>{bet.title}</Text>
        </View>
        <View style={styles.countdownContainer}>
          <Text style={styles.wagerText}>{bet.wager}</Text>
        </View>
        {bet.status === 'open' && bet.lockDate && (
          <View style={[styles.row, styles.timerRow, styles.countdownContainer]}>
            <View>
              <Icon name="md-time" type="ionicon" size={20} color={ThemeColors.border} />
            </View>
            <View style={styles.timerContainer}>
              <Text style={styles.createdByText}>{this.renderTimer()}</Text>
            </View>
          </View>
        )}
        {buttons[bet.status]}
        {bet.status === 'open' || bet.status === 'voting' ? (
          <View style={styles.action}>
            <Text style={styles.actionText}>{bet.status === 'open' ? "Choose" : "Vote"}</Text>
          </View>
        ) : null}
      </View>
    );

    return (
      <SafeAreaView>
        <StatusBar backgroundColor={ThemeColors.background} barStyle="light-content" />
        <LoadingSpinner spinning={loading} />
        <View style={styles.list}>
          <FlatList
            ListHeaderComponent={header}
            stickyHeaderIndices={[0]}
            data={bet.options}
            renderItem={({ item, index }) => this.renderOption(item, index)}
            keyExtractor={(item, index) => index.toString()}
          />
        </View>
      </SafeAreaView>
    );
  }
}

BetOptions.contextType = UserColors;

export default (props) => {
  const theme = useTheme();

  return <BetOptions {...props} theme={theme} />
}

const styles = StyleSheet.create({
  action: {
    alignSelf: 'center',
    textAlign: 'center',
    marginTop: 5,
  },
  actionText: {
    fontSize: 22,
    fontWeight: 'bold'
  },
  lockButton: {
    paddingVertical: 2,
    minHeight: 31,
  },
  lockButtonContainer: {
    width: '33%',
    alignSelf: 'center',
    marginTop: 10
  },
  cancelButtonContainer: {
    width: '20%',
  },
  cancelButtonTitle: {
    fontSize: 14,
    marginVertical: -2,
  },
  container: {
    backgroundColor: '#f2f2f2',
    paddingTop: 15,
    paddingBottom: 25
  },
  countdownContainer: {
    alignSelf: 'center',
  },
  createdByContainer: {
    marginLeft: 5,
    marginTop: Platform.OS === 'ios' ? -3 : -4
  },
  createdByRowContainer: {
    justifyContent: 'center',
    height: 34
  },
  createdByText: {
    fontSize: 17,
  },
  disabledOption: {
    opacity: 0.69,
  },
  list: {
    paddingBottom: 0,
    height: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  saveButtonContainer: {
    width: '20%',
    marginRight: 8
  },
  saveButtonBorder: {
    borderRadius: 20,
  },
  saveButtonTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginVertical: -2,
  },
  timerRow: {
    marginTop: 15,
    marginBottom: 10,
  },
  timerContainer: {
    marginLeft: 5,
    marginTop: -1
  },
  title: {
    paddingTop: 15,
    // alignSelf: 'center',
  },
  titleText: {
    textAlign: 'center',
    fontSize: 22,
    color: ThemeColors.textTitle,
    textShadowColor: ThemeColors.textTitle,
    textShadowRadius: Platform.OS === 'android' ? 12 : 6,
  },
  wagerText: {

  },
  userListContainer: {
    paddingTop: 10
  },
  userListOptionContainer: {
    maxWidth: '60%'
  }
});
