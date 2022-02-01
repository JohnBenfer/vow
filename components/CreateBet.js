import React from 'react';
import { StyleSheet, View, StatusBar, ScrollView, SafeAreaView, TouchableWithoutFeedback, Platform, Pressable, KeyboardAvoidingView } from 'react-native';
import { Input, Text, Button, Icon, CheckBox } from 'react-native-elements';
import DateTimePicker from '@react-native-community/datetimepicker';
import LoadingSpinner from './LoadingSpinner';
import * as firebase from 'firebase';
import { WriteUserToFile } from '../Util';
import * as FileSystem from 'expo-file-system';
import { UserFilePath } from '../Constants';
import * as Haptics from 'expo-haptics';
import { ThemeProvider } from '@react-navigation/native';
import ThemeColors from '../assets/ThemeColors';

export default class CreateBet extends React.Component {
  constructor(props) {
    super(props);

    this.scrollRef = new React.createRef();

    this.state = {
      title: '',
      titleError: false,
      options: [{ title: '' }, { title: '' }],
      optionsErrors: false,
      wager: null,
      setLockDate: false,
      lockDate: new Date(),
      lockTime: new Date(),
      timeError: false,
      showDatePicker: false,
      showTimePicker: false,
      loading: false,
    };
  }

  handleBetChange = (title) => {
    this.setState({ title, titleError: false });
  };

  addOption = () => {
    const { options } = this.state;
    options.push({ title: '' });

    this.setState({ options });
  };

  removeOption = (index) => {
    const { options, optionsErrors } = this.state;
    options.splice(index, 1);

    if (optionsErrors) {
      this.setState({ optionsErrors: options.find(option => option.title.trim() === '') })
    }

    this.setState({ options });
  };

  handleOptionChange = (text, index) => {
    let { options, optionsErrors } = this.state;
    options[index].title = text;

    if (optionsErrors) {
      this.setState({ optionsErrors: options.find(option => option.title.trim() === '') })
    }

    this.setState({ options });
  };

  handleWagerChange = (wager) => {
    this.setState({ wager });
  };

  toggleSetLockDate = () => {
    this.setState((prevState) => ({ setLockDate: !prevState.setLockDate }), () =>
      setTimeout(() => this.scrollRef.scrollToEnd({ animated: true }), 2)
    );
  };

  formatTime = (date) => {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 ? hours % 12 : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes} ${ampm}`;
  };

  showDatePicker = () => {
    this.setState({ showDatePicker: true });
  };

  showTimePicker = () => {
    this.setState({ showTimePicker: true });
  };

  onDateChange = (event, lockDate) => {
    this.setState({ lockDate: lockDate || this.state.lockDate, showDatePicker: Platform.OS !== 'android', timeError: false });
  };

  onTimeChange = (event, lockTime) => {
    if (lockTime > new Date() || this.state.lockDate > new Date()) {
      this.setState({ lockTime, showTimePicker: Platform.OS !== 'android', timeError: false });
    } else {
      this.setState({ showTimePicker: Platform.OS !== 'android', timeError: true });
    }
  };

  validateFields = () => {
    this.setState({ optionsErrors: this.state.options.find(option => option.title.trim() === '') !== null, titleError: this.state.title.trim() === '' });
    return !this.state.options.find(option => option.title.trim() === '') && this.state.title.trim() !== '';
  }

  create = async () => {
    const { user, lobby } = this.props.route.params;

    if (this.validateFields()) {
      this.setState({ loading: true });
      let lockDate = Platform.OS === 'android' ? new Date(this.state.lockDate.getFullYear(), this.state.lockDate.getMonth(), this.state.lockDate.getDate(),
        this.state.lockTime.getHours(), this.state.lockTime.getMinutes()) : this.state.lockDate;
      const betRef = await firebase.database().ref('Bet').push();
      const bet = {
        options: this.state.options,
        createdBy: user.username,
        createdDate: firebase.database.ServerValue.TIMESTAMP,
        lobbyId: lobby.id.replace('https://social-jbm-default-rtdb.firebaseio.com/Lobby/', ''),
        lockDate: this.state.setLockDate ? lockDate.getTime() : null,
        status: 'open',
        title: this.state.title,
        wager: this.state.wager,
      };

      await betRef.set(bet);
      // update local file
      let oldUser;
      await FileSystem.readAsStringAsync(UserFilePath).then((data) => {
        oldUser = JSON.parse(data);
      });
      let newUser = {
        ...oldUser,
        bets: [
          ...oldUser.bets,
          betRef.toString().replace('https://social-jbm-default-rtdb.firebaseio.com/Bet/', '')
        ]
      };
      await WriteUserToFile(newUser);

      this.setState({ loading: false });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      this.props.navigation.goBack();
    }
  };

  render() {
    const {
      loading,
      title,
      titleError,
      options,
      optionsErrors,
      setLockDate,
      lockDate,
      lockTime,
      timeError,
      wager,
      showDatePicker,
      showTimePicker,
    } = this.state;

    const setEndDateTitle = (
      <View style={styles.row}>
        <View>
          <Icon name="md-time" type="ionicon" size={20} color={ThemeColors.border}/>
        </View>
        <View style={styles.timerContainer}>
          <Text style={styles.setEndDateText}>Set Lock Date:</Text>
        </View>
      </View>
    );

    return (
      <SafeAreaView>
        <StatusBar backgroundColor={ThemeColors.background} barStyle="light-content" />
        <LoadingSpinner spinning={loading} />
        <View style={styles.container}>
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
            <View style={styles.saveButtonContainer}>
              <Button
                onPress={this.create}
                title="Save"
                containerStyle={styles.saveButtonBorder}
                titleStyle={styles.saveButtonTitle}
                disabled={optionsErrors || titleError}
              />
            </View>
          </View>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0} >
          <ScrollView style={styles.scrollView} ref={(scroll) => { this.scrollRef = scroll; }}>
            <View style={styles.title}>
              <Text style={[styles.createBetTitle, {fontFamily: 'Audio-Wide'}]}>Create Vow</Text>
            </View>
            <View>
              <Input
                placeholder="Vow"
                onChangeText={this.handleBetChange}
                value={title}
                maxLength={55}
                errorMessage={titleError ? "This field is required" : null}
              />
            </View>
            <View style={styles.options}>
              <Text style={[styles.optionsText, {fontFamily: 'Audio-Wide'}]}>Options</Text>
              {options.map((option, index) => (
                <Input
                  placeholder={`Option ${index + 1}`}
                  onChangeText={(text) => this.handleOptionChange(text, index)}
                  value={option.title}
                  rightIcon={index > 1 && (
                    <Pressable onPress={() => this.removeOption(index)} hitSlop={40}>
                      <Icon name="md-close" type="ionicon" size={15} color={ThemeColors.button}/>
                    </Pressable>
                  )}
                  rightIconContainerStyle={styles.removeOptionButton}
                  key={index}
                  maxLength={36}
                  errorMessage={optionsErrors && option.title.trim() === '' ? "This field is required" : null}
                />
              ))}
              {options.length < 20 && (
                <Pressable onPress={this.addOption} hitSlop={10}>
                  <Icon
                    reverse
                    size={20}
                    name="md-add"
                    type="ionicon"
                    color={ThemeColors.button}
                    onPress={this.addOption}
                  />
                </Pressable>
              )}
            </View>
            <View>
              <Input
                placeholder="Wager (optional)"
                onChangeText={this.handleWagerChange}
                value={wager}
                maxLength={50}
              />
            </View>
            <View>
              <CheckBox
                checked={setLockDate}
                uncheckedIcon={
                  <Icon
                    name="toggle-switch-off"
                    type="material-community"
                    size={50}
                    color={ThemeColors.disabledButton}
                    onPress={this.toggleSetLockDate}
                  />
                }
                checkedIcon={
                  <Icon
                    name="toggle-switch"
                    type="material-community"
                    size={50}
                    color={ThemeColors.button}
                    onPress={this.toggleSetLockDate}
                  />
                }
                title={setEndDateTitle}
                iconRight
                containerStyle={styles.switch}
              />
            </View>
            {setLockDate &&
              (Platform.OS === 'android' || Platform.OS === 'web' ? (
                <View style={styles.row}>
                  <TouchableWithoutFeedback onPress={this.showDatePicker}>
                    <View style={styles.dateTimeInput}>
                      <Input
                        style={styles.dateTimeInput}
                        label="Date"
                        value={lockDate.toDateString()}
                        disabled={true}
                      />
                    </View>
                  </TouchableWithoutFeedback>
                  <TouchableWithoutFeedback onPress={this.showTimePicker}>
                    <View style={styles.dateTimeInput}>
                      <Input
                        style={styles.dateTimeInput}
                        label="Time"
                        value={lockTime ? this.formatTime(lockTime) : this.formatTime(new Date())}
                        errorMessage={timeError ? 'Time must be in the future' : null}
                        errorStyle={styles.dateTimeInputError}
                        disabled={true}
                      />
                    </View>
                  </TouchableWithoutFeedback>
                  {showDatePicker && (
                    <DateTimePicker
                      mode="date"
                      value={lockDate || new Date()}
                      onChange={this.onDateChange}
                      minimumDate={new Date()}
                    />
                  )}
                  {showTimePicker && (
                    <DateTimePicker
                      mode="time"
                      display="spinner"
                      value={lockTime || new Date()}
                      onChange={this.onTimeChange}
                    />
                  )}
                </View>
              ) : (
                  <DateTimePicker
                    mode="datetime"
                    value={lockDate || new Date()}
                    onChange={this.onDateChange}
                    minimumDate={new Date()}
                  />
                ))}
            <View style={styles.bottomView}></View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  scrollView: {
    paddingHorizontal: 20,
    marginBottom: Platform.OS === 'android' ? 90 : 0,
  },
  bottomView: {
    height: Platform.OS === 'ios' ? 120 : 0,
  },
  title: {
    paddingTop: 5,
    marginBottom: 50,
  },
  options: {
    marginVertical: 10,
    alignItems: 'center',
  },
  optionsText: {
    fontSize: 25,
    color: ThemeColors.border,
    marginBottom: 10,
  },
  removeOptionButton: {
    marginRight: 0,
    paddingRight: 0,
  },
  switch: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginLeft: 0,
    marginVertical: 0,
    paddingHorizontal: 0,
  },
  dateTimeInput: {
    width: '50%',
    opacity: 1,
  },
  dateTimeInputError: {
    margin: 0,
    fontSize: 11,
  },
  container: {
    paddingTop: 15
  },
  cancelButtonContainer: {
    width: '20%',
  },
  cancelButtonTitle: {
    fontSize: 14,
    marginVertical: -2,
  },
  saveButtonContainer: {
    width: '20%',
    position: 'absolute',
    right: 8,
  },
  saveButtonBorder: {
    borderRadius: 20,
  },
  saveButtonTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginVertical: -2,
  },
  setEndDateText: {
    fontSize: 15,
    fontWeight: 'bold'
  },
  timerContainer: {
    marginLeft: 5,
    marginRight: 10
  },
  row: {
    flexDirection: 'row',
  },
  createBetTitle: {
    marginTop: 20,
    fontSize: 35,
    color: ThemeColors.textTitle,
    textShadowColor: ThemeColors.textTitle,
    textShadowRadius: Platform.OS === 'android' ? 12 : 6,
    paddingHorizontal: 5,
    textAlign: 'center',
  }
});
